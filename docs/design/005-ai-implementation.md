# 005 – AI implementation: zoom command (design)

- **Status:** Draft
- **Date:** 2026-11-09
- **Spec:** [005 – AI implementation: zoom command](../specs/005-ai-implementation.md)
- **Next agent:** developer

## Summary

The browser sends the cleaned text to one Route Handler (`POST /api/command`). The server runs a
fixed pipeline: guard -> client IP -> rate limit -> validation -> cooldown / daily cap -> Groq
(`openai/gpt-oss-20b`, strict JSON schema, returns an action and a place name) -> Nominatim
(worldwide) -> result code and map bounds. State lives in one JSON file behind a
`StateStore` interface. Groq, the geocoder, the store and the clock are interfaces so tests
replace them; `MapEngine` gets `moveTo`.

## Decisions

### D-1: Model – `openai/gpt-oss-20b` on Groq (FR-7, NFR-1)

- **Choice:** `openai/gpt-oss-20b` (env `GROQ_MODEL`), plain `fetch` to
  `https://api.groq.com/openai/v1/chat/completions`, no SDK. `response_format` `json_schema`
  with `strict: true`, `reasoning_effort: "low"`, `include_reasoning: false`, temperature 0,
  no streaming, small `max_completion_tokens` (reasoning counts).
- **Verified 2026-11-09:** Groq documents `strict: true` (constrained decoding) only for
  `gpt-oss-20b`, `gpt-oss-120b`, `qwen3.8-27b` and `muse-spark-open`; other models get only JSON
  Object Mode ([structured outputs](https://console.groq.com/docs/structured-outputs)).
  `gpt-oss-20b` is the smallest and fastest of them (~1000 tok/s,
  [model page](https://console.groq.com/docs/model/openai/gpt-oss-20b)). `llama-3.1-8b-instant`
  rejected (no schema enforcement).
- **Free limits:** the [rate-limits page](https://console.groq.com/docs/rate-limits) lists 30 RPM,
  1K RPD, 8K TPM, 200K TPD (base limits, console authoritative); a third-party post claims
  14,400 RPD, so the lower figure is assumed. Per organisation, reset 00:00 UTC, no card on the
  free tier (never upgrade, NFR-1). Exhaustion: HTTP 429 with `retry-after`. ~300-500 tokens per
  call fits ~400-600 calls/day, hence the default `DAILY_CAP`.
- **Concerns:** the developer checks the real limits once in the Groq console (T-8).

### D-2: Geocoder – public Nominatim (FR-14, AC-14, NFR-1)

- **Choice:** `GET {GEOCODER_URL}/search?q=<place>&limit=5&format=jsonv2&addressdetails=0`
  from the server; default `https://nominatim.openstreetmap.org`, replaceable by a self-hosted
  instance. No key.
- **Terms checked 2026-11-09** ([usage policy](https://operations.osmfoundation.org/policies/nominatim/)),
  AC-14: free of charge; max 1 request/s for the whole app; identifying `User-Agent` required
  (built from `GEOCODER_CONTACT`); OSM attribution required (ODbL), already shown in the map
  attribution; caching encouraged (in-memory LRU, nothing persisted); user-triggered searches
  are fine for moderate use, autocomplete and bulk are forbidden (we do neither); the operator
  must be able to switch the app off (stop the endpoint); only the place name is sent. No SLA,
  policy may change.
- **Verified live:** `Šumava` -> mountain range, `boundingbox` is `[south, north, west, east]`
  (strings); `Sumava` (no diacritics) -> a minor information board. So the model prompt
  restores missing diacritics of Czech names and keeps other names as typed. The search has no
  country restriction (user decision, worldwide); up to 5 candidates are requested and only
  place-like categories count, so "Vienna" is the city, not a hotel of that name. Czech places
  get no preference when a name is shared.
- **Alternatives considered:** Mapy.com geocoding (Seznam account, logo obligation, Extended
  tariff requires Mapy.com-only map data, caching rules not found); Photon (no clearer terms).

### D-3: Valibot 1.5.0 for runtime validation (FR-4, FR-7)

MIT, no dependencies, bundled types, `sideEffects: false`; used for every boundary (request,
Groq, geocoder, env, state file, browser-side response). Zod rejected: larger client bundle.

### D-4: Closed action list in one place (FR-7, NFR-7, AC-30)

`src/shared/command/actions.ts` is a registry: action name -> parameter schema (Valibot) and
strict JSON schema for Groq. Model output is a registry action or built-in `unsupported`. Server
handlers are an exhaustive `Record<ActionName, Handler>`, so a new action fails compilation until
handled; guard, validation, cooldown, limits and codes are action-agnostic. Now only
`zoom_to_place { place }`. A test checks the JSON schemas follow Groq's strict rules.

### D-5: Client IP – operator-named trusted header (FR-15, AC-19)

- **Finding:** route handlers expose no socket address, and `next start` fills `x-forwarded-for`
  only when absent (`??=` in `next/dist/server/base-server.js`), so a direct caller can forge it.
- **Choice:** env `CLIENT_IP_HEADER` names a single-valued header that the platform or reverse
  proxy always overwrites (e.g. `cf-connecting-ip`, `x-real-ip`, `fly-client-ip`). Only it is
  read, all others are ignored. Required in production; missing or non-IP value -> `error`.
  In `next dev` with it unset, the `x-forwarded-for` filled by Next from the socket is used.
  Parsed with `node:net` `isIP`; IPv4-mapped IPv6 becomes IPv4; IPv6 is reduced to its /64.
- **Alternatives considered:** `x-forwarded-for` (forgeable); custom Node server reading the
  socket (leaves standard `next start`). The app must be reachable only through the proxy.

### D-6: State storage – one JSON file (NFR-4, FR-12, FR-13, AC-29)

- **Choice:** `FileStateStore.transact` runs read-modify-write under an in-process mutex (kept
  on `globalThis`, bundles may duplicate modules) plus a lock file with stale expiry; write =
  temp file + `rename`. Location `STATE_DIR` (default `.data/`, in `.gitignore`, never under
  `public/`). Each transaction first drops expired data. No typed text is stored.
- **Fail safe:** missing file = empty state; unreadable, invalid or unwritable state, lock
  timeout -> `StateUnavailableError` -> `error`, no AI call. No auto-reset.
- **Rules** (pure, tested with `FakeClock` + `MemoryStateStore`):
  - rate limit: sliding log, 10 per 60 s per client; every request passing the guard counts;
  - cooldown: set when an admitted command ends, whatever the result (success, unsupported,
    not found, AI/geocoder failure), 10 s; `wait` carries the remaining seconds; not set for
    requests refused before admission or by Groq's quota (`ai_resting`);
  - in-flight mark per client (set at admission, cleared at completion, expires with the
    request budget): a concurrent request gets `too_many_requests`, never reaching the AI;
  - daily cap per UTC day, counted at admission, not refunded; `DAILY_CAP` (default 500, below
    Groq's limit); `ai_resting` with `resetAt` = next 00:00 UTC;
  - Groq 429: stores `aiBlockedUntil` (`retry-after`, at most next UTC midnight), no cooldown.
- **Alternatives considered:** SQLite (native dependency); memory only (violates NFR-4).
- **Time budget (FR-3):** one `AbortSignal` (slightly below the client's 10 s) goes to both
  services; Nominatim calls are serialised (>= 1 s apart). A success finishing after the client
  gave up still starts the server cooldown; accepted.

### D-7: Map target as bounds (FR-2, FR-8, AC-26)

The server returns the geocoder's bounding box (`boundsSchema` checks the world
range). For a place made of several areas the plain box spans every part (Tokyo reaches its
far islands, France its overseas territories, Russia and Alaska the whole globe across the 180°
line), so the request also asks for a simplified outline (`polygon_geojson`, tolerance 0.1°)
and the box of the area that holds the place's centre point is used instead
(`geocoding/mainBody.ts`; the largest area if none does; the plain box if the outline is
missing or odd); `MAP_CONFIG.czechBounds` is only the view the map opens with. The engine calls `fitBounds` with a shared max zoom: a city is shown whole, a
village or street is capped at close zoom. Reduced motion (`matchMedia` at call time) ->
`"jump"`. Server-computed zoom rejected (needs viewport size).

### D-8: Client cooldown and version

The cooldown end time is kept in `localStorage`, read on mount (no status endpoint); if cleared,
the server answers `wait` and the UI enters the same paused state (AC-12). The developer bumps
the version 0.1.3 -> 0.1.4 (T-8) per `.claude/agents/developer.md`.

## Dependencies

| Package | Version | Purpose | Install / bundle size |
|---|---|---|---|
| valibot | 1.5.0 | Runtime validation at all boundaries | ~1.9 MB unpacked; tree-shaken, ~1-2 kB per schema |
| server-only | 0.0.1 | Build error if server modules reach the browser | 611 B |

No `@types/*` needed. Vitest aliases `server-only` to an empty module. No Groq SDK (`fetch`).

## Components

| Component | Responsibility | Folder |
|---|---|---|
| Route | Wires production dependencies to the handler; `POST` only | `src/app/api/command/` |
| Command handler, client IP | Guard, pipeline order, result mapping, HTTP status, logging | `src/server/command/` |
| Env config | Valibot-validated env, read lazily | `src/server/config/` |
| AI client | `AiClient` interface + Groq implementation | `src/server/ai/` |
| Geocoder | `Geocoder` interface + Nominatim client, throttle, LRU | `src/server/geocoding/` |
| State | `StateStore`, `Clock`, file and memory stores, limit rules | `src/server/state/` |
| Shared contracts | Action registry, text rules, contract schemas | `src/shared/command/` |
| Command client, CommandInput (changed) | `fetch` wrapper, cooldown storage, states, countdown | `src/components/command-input/` |
| MapView, MapEngine, messages (changed) | Input gets `moveTo`; `command.*` texts, new hint | `src/components/map/`, `src/map/`, `messages/` |

Server modules import `server-only`; pure logic is separate from I/O.

## Data flow

1. Enter -> client normalises; empty = nothing (AC-2); engine missing -> `error`, no request
   (AC-23); else loading and `POST /api/command` (abort at 10 s -> local `error`).
2. Server: guard -> client IP -> rate-limit hit -> body, schema, text check -> admission
   transaction (cooldown, cap / `aiBlockedUntil`, in-flight mark) -> `AiClient.interpret` ->
   output schema -> `unsupported` ends -> `Geocoder.find` -> completion transaction
   (start cooldown, clear in-flight), also for `unsupported`, `not_found` and `error` after
   admission. Only a spent Groq quota releases the mark without a cooldown.
3. Client validates the response; success -> `moveTo`, field cleared, cooldown starts; failure
   with `cooldownSeconds` -> message stays visible and the cooldown starts too.
   Language switch re-renders the stored code, no request (AC-21).

## Interfaces

```ts
// src/shared/command/ (client-server contract, validated with Valibot on both sides)
export type Locale = "cs" | "en";
export interface CommandRequest { text: string; locale: Locale } // strict: no other fields
export type Bounds = [[west: number, south: number], [east: number, north: number]];
export type CommandResult = { action: "zoom_to_place"; bounds: Bounds }; // grows per action
export type CommandErrorCode = "invalid_request" | "unsupported" | "not_found" | "wait"
  | "too_many_requests" | "ai_resting" | "error";
export type CommandResponse =
  | { ok: true; result: CommandResult; cooldownSeconds: number }
  | { ok: false; error: { code: CommandErrorCode; retryAfterSeconds?: number; resetAt?: string;
      cooldownSeconds?: number } };
export function normalizeCommandText(raw: string): string; // client cleans
export function isCleanCommandText(text: string): boolean; // server rejects otherwise
```

Text rules: NFC, well-formed Unicode, line breaks/tabs become spaces, other `Cc`, `Cf` (zero-width,
bidi), `Zl`, `Zp`, `Co`, `Cn` removed, whitespace collapsed, trimmed, at most 200 code points.
The server does not clean: text differing from its normalised form is `invalid_request`. HTTP:
`invalid_request` 400 (405/415/413/403 same body), `wait`/`too_many_requests` 429 +
`Retry-After`, `ai_resting` 503, `error` 500, `unsupported`/`not_found` 200. All failures share
one shape, no detail.

```ts
// src/server/ai/ - parsed from message.content; finish_reason must be "stop"
export type ModelOutput = { action: "zoom_to_place"; place: string } | { action: "unsupported" };
export type AiResult = { kind: "output"; output: ModelOutput }
  | { kind: "quota_exhausted"; retryAfterSeconds?: number }; // Groq 429; other failures throw
export interface AiClient {
  interpret(input: { text: string; locale: Locale }, signal: AbortSignal): Promise<AiResult>;
}

// src/server/geocoding/ - place: 1-100 chars, same character rules, never shown to the user
export interface Geocoder {
  find(place: string, signal: AbortSignal): Promise<{ bounds: Bounds } | null>; // null = not found
}

// src/server/state/
export interface Clock { now(): number } // epoch ms; FakeClock in tests
export interface StateData {
  version: 1;
  daily: { day: string; count: number }; // UTC "YYYY-MM-DD"
  aiBlockedUntil?: number;
  clients: Record<string, { hits: number[]; cooldownUntil?: number; inflightUntil?: number }>;
}
export interface StateStore {
  /** Atomic read-modify-write; throws StateUnavailableError on any storage problem. */
  transact<T>(fn: (state: StateData) => { next: StateData; result: T }): Promise<T>;
}

// src/map/types.ts
export interface MapTarget { bounds: Bounds }
export interface MapEngine {
  readonly controlsSlot: HTMLElement;
  moveTo(target: MapTarget, motion: "animate" | "jump"): void;
  destroy(): void;
}
```

Groq receives a system prompt, the text (as a JSON-encoded data field, never concatenated into
instructions, FR-7) and the UI language. The geocoder receives only `place`. Messages: namespace
`command`, one key per code plus loading, paused (ICU plural for seconds: Czech
`one/few/many/other`), paused-start and resumed announcements; `aiResting` has variants with
and without reset time. The hint `showCyclingRoutes` is replaced; the 8 hints (Prague, High Tatras, 1st Avenue in
New York, France, Moscow, Tokyo, Grand Canyon, Mount Everest) all geocode to places.

## External services

| Service | Purpose | Free-tier limits | Key / config |
|---|---|---|---|
| Groq (`openai/gpt-oss-20b`) | Text -> action + place name | 30 RPM, 1K RPD, 8K TPM, 200K TPD; no card | `GROQ_API_KEY`, `GROQ_MODEL` (server) |
| Nominatim (OSM) | Place name -> bounds in CZ | 1 req/s for the app, UA, attribution | `GEOCODER_URL`, `GEOCODER_CONTACT` (server) |

Other server env: `CLIENT_IP_HEADER`, `APP_ORIGIN` (allowed `Origin` values; dev default
`http://localhost:3000`, required in production), `STATE_DIR`, `DAILY_CAP`. `.env.example` lists
all names without real values; real `.env*` files are already ignored. Missing or invalid
`GROQ_API_KEY` -> `error`, no call.

## Error handling

- Guard/shape failure, unclean text -> `invalid_request`; missing IP header, state problem,
  invalid model output, 5xx, timeout, bad key -> `error`; no AI call where not yet made. A
  failure after admission (AI, geocoder, timeout) still carries `cooldownSeconds`
  (FR-4, 5, 11, 15, AC-10, 17, 29).
- Cooldown -> `wait`; rate limit, in-flight -> `too_many_requests`; cap, `aiBlockedUntil`, Groq
  429 -> `ai_resting` (FR-12, FR-13). `unsupported` action -> `unsupported`; geocoder null or
  outside CZ -> `not_found`.
- Logs: result code and duration only; never text, IP, key, upstream bodies (AC-22).

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1, 3, 17 / AC-2, 3, 23 | D-6; T-5, T-7 |
| FR-2, 14 / AC-1, 14, 28 | D-1, D-2, D-7; T-4, T-6 |
| FR-4, 5 / AC-4–7 | Text rules, guard; T-2, T-5, T-7 |
| FR-6, 15 / AC-8, 19, 22 | D-5, `server-only`, logging; T-1, T-5 |
| FR-7, 8 / AC-9, 10 | D-4, D-7, schemas; T-2, T-4, T-5 |
| FR-9–13 / AC-11–13, 15–18 | Result codes, D-6, D-8; T-3, T-5, T-7 |
| FR-16, 18 / AC-20, 21, 25 | T-7 |
| FR-19 / AC-24 | T-8 |
| NFR-1–3 / AC-21, 26, 31 | D-1, D-2, D-7; T-6, T-7 |
| NFR-4–6 / AC-27–29 | D-6; T-3, T-4, T-7 |
| NFR-7–9 / AC-30, 32, 33 | D-4, interfaces, `FakeClock`; T-2–T-7; manual (T-8) |

## Implementation plan

1. **T-1: Setup** – `valibot`, `server-only`, Vitest alias, env schema, `.env.example`,
   `.gitignore` gets `.data/`. Done when: build, lint, typecheck, tests green. Covers: FR-6,
   AC-31.
2. **T-2: Shared contracts** – action registry, text rules, contract schemas. Done when: tests for
   characters, length, strict shapes pass. Covers: FR-4, FR-7, NFR-7, AC-4–6, 30.
3. **T-3: State** – `Clock`, stores, limit rules. Done when: tests cover cooldown, rate limit,
   cap, rollover, cleanup, parallel `transact`, restart, corrupt file. Covers: FR-12, FR-13,
   NFR-4, AC-12, 13, 18, 29.
4. **T-4: AI client and geocoder** – stubbed `fetch` tests. Done when: requests carry only
   allowed data and every failure behaves as specified. Covers: FR-7, 8, 14, NFR-5, AC-9, 10, 28.
5. **T-5: Endpoint** – guard, client IP, pipeline, status mapping, logging, route. Done when:
   handler tests cover every code, forged header, missing key, concurrency, no secrets in
   bodies or logs; manual `curl` works. Covers: FR-4–9, 12–15, AC-3–10, 12, 13, 15–19, 22, 29.
6. **T-6: Map move** – `MapEngine.moveTo`; update fakes. Done when: a mock-map test checks the
   `fitBounds` options and jump vs animate. Covers: FR-2, FR-8, AC-26.
7. **T-7: Client** – command client, cooldown storage, `CommandInput` states, countdown,
   announcements, `MapView` wiring, messages, new hint. Done when: component tests pass in both
   languages and a manual run moves the map. Covers: FR-1–3, 9–11, 16–18, NFR-2, 3, 6,
   AC-1–3, 11, 15–17, 20, 21, 23, 25, 27.
8. **T-8: Docs and checks** – README per FR-19 (incl. env setup without a real key and the proxy
   IP header), version 0.1.4, real Groq limits checked in the console, manual checks. Done
   when: lint, typecheck, test, build green. Covers: FR-19, AC-24, 33.

## Testing

Vitest, no real AI or geocoder call. Handler tests use fakes (`AiClient`, `Geocoder`,
`MemoryStateStore`, `FakeClock`); `FileStateStore` tests use a temp dir and real `fs` (AC-32):
AC-9/10 outputs, 9 s vs 10 s, 11th request, rollover, restart, corrupt file, parallel
`transact`, forged header, no secrets in bodies or logs. Client: component tests with a stubbed
command client and fake timers (states, countdown, restore, Czech plurals for 1, 2, 5 s); the
messages parity test covers new keys.

Manual: AC-1 with real Groq and Nominatim ("Plzen", "Šumava", "Vienna"); AC-8 (key not in
`.next/static` or page source); AC-20, 26, 33; run behind a proxy that sets `CLIENT_IP_HEADER`.

## Risks / open questions

- Hosting is not decided: needs a persistent disk, one instance and a trusted client-IP header.
- Groq free limits differ between sources (D-1); the cap is configurable.
- Public Nominatim has no SLA, policy may change; swap via `GEOCODER_URL`. Ambiguous names may
  resolve badly.
- Prompt injection can not be fully excluded; layered defence per the spec.
- Privacy notice and terms stay a TODO before launch. IPs are stored in plain form, <= 60 s.
