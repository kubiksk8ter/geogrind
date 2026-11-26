# 009 – Side panel "Metrics" tab, phase 1: AI usage (design)

- **Status:** Draft
- **Date:** 2026-11-13
- **Spec:** [009 – Side panel "Metrics" tab, phase 1: AI (Groq) usage](../specs/009-sidebar-metrics-ai.md)
- **Next agent:** developer

## Summary

`GroqClient` reports every HTTP answer (usage and rate-limit headers, parsed and validated) to an
observer. A recorder adds the day's tokens to the existing state file in one atomic transaction
and keeps the latest "last request" and limit figures in memory. A new read-only
`GET /api/metrics` returns one grouped snapshot (`ai` group) with absolute reset times. The
browser polls it while the tab is visible and counts down locally. Bars are Base UI `Meter`; no
new package.

## Decisions

### D-1: Where the figures live (FR-3, FR-8, FR-10, NFR-7, AC-4, AC-21)

- **Choice:** two homes by how long a figure stays true.
  - **Persistent, in the existing state file** (`daily` block of `StateData`): the cap counter
    `count` (already there) and the new `tokens` (day's token total). They follow the rules of
    design 005 D-6: same UTC-day rollover (`pruneState`), same lock + atomic rename, so parallel
    requests neither lose nor double count; `tokens` is added in its own `transact` per answer.
  - **Volatile, in memory** (`globalThis` singleton, like the state queues): last request
    (`usage`) and the latest limit figures with their absolute reset times. After a restart they
    are unknown, which is exactly the empty state of FR-10.
- **Why not persist the rest:** limit figures describe a per-minute window and a countdown; after
  a restart they are stale by definition, and persisting them only adds writes and a larger
  schema. Latest wins by `receivedAt`.
- **Instances:** design 005 already requires one instance and a persistent disk (the cap would be
  wrong otherwise). Daily figures are correct for several instances sharing that disk. The
  volatile part would show only the instance that served the request; moving it into the state
  file later is a change inside the recorder (behind `AiFigures`), not in the contract.
- **State schema:** `daily.tokens` is `optional(..., 0)` in `stateDataSchema`, so an existing
  `.data/state.json` stays valid (the current schema is strict and a failed parse is a hard
  `StateUnavailableError`). `pruneState` must carry `tokens` and reset it with `count`.
  Existing tests that build `StateData` literals need the field.
- **Alternatives considered:** SQLite / Redis (new service or native dependency, no gain for
  one instance); everything in memory (violates NFR-7 for the day's total); everything in the
  file (extra schema for figures that die in minutes).

### D-2: Collecting figures – observer in `GroqClient`, return type unchanged (FR-2, FR-4, NFR-6)

- **Choice:** `GroqClientOptions` gets `observe?: (a: AiAnswer) => void` and `clock`. The client
  calls it for every HTTP response it receives (2xx, 429, other statuses), right after reading
  the body and before output validation, so a request with invalid output still reports its
  `usage` (AC-2). The call is wrapped in `try/catch` and not awaited: a failing or slow
  recorder never changes the command result or timing (AC-20). `AiClient`, `AiResult` and the
  command handler stay as they are.
- **Deviation from the brief:** the brief suggested extending the client's return type. That
  would have to be threaded through `AiResult`, `AiError` (invalid output throws) and the
  handler; an observer reaches every path with one change.
- **Parsing (pure, in `src/server/ai/`):**
  - `usage` from the 2xx body via a separate Valibot schema, each of the three counts
    independently nullable; non-integer, negative or oversized (> a sane bound, developer picks)
    -> `null`. The existing `completionSchema` is untouched, so a bad `usage` cannot fail a
    command.
  - Headers `x-ratelimit-limit-/remaining-/reset-` x `requests/tokens` (names verified in the
    [Groq docs](https://console.groq.com/docs/rate-limits) 2026-11-13: requests are per day,
    tokens per minute, reset as `2m59.56s` / `7.66s`). Counts as in `usage`; a pair with
    `remaining > limit` -> both `null`.
  - `parseGroqDuration(value: string | null): number | null` (seconds): grammar
    `(number unit)+`, units `d h m s ms` (`ms` matched before `m`), decimals allowed; empty,
    negative, unknown unit, junk, zero parts or a huge result -> `null`. Reset time =
    `receivedAt + seconds * 1000` (absolute, FR-6).
- **Recording rule:** the daily total gets `usage.total` when it is a valid count (not for 429,
  not when missing; no invention from prompt + completion). The in-memory snapshot is replaced
  only when the answer carries at least one valid limit figure (a 401 without headers must not
  wipe good data); `lastRequest` is replaced only by an answer with at least one valid count.

### D-3: Delivery to the UI – polling, 10 s class interval (FR-12, FR-13, AC-13, AC-14)

- **Choice:** the browser fetches `GET /api/metrics` on opening the tab and then at a fixed
  interval clearly below the 15 s of FR-12 (developer picks, e.g. the 10 s cooldown), only while
  the panel is open, the tab selected and `document.visibilityState` is visible; a
  `visibilitychange` to visible fetches at once. Failure keeps the last snapshot, marks it as
  possibly out of date and the next poll is the retry (no user action). A new fetch is not
  started while the previous one runs; each has a timeout.
- **Alternatives considered:** update after each own request (does not show other users'
  requests, FR-12); SSE / WebSocket (long-lived connections per visitor on a host that is not
  chosen yet, reconnect logic, more server state, for a figure that changes at most every few
  seconds); `Cache-Control` revalidation tricks (no need).
- **Reads are cheap and side-effect free:** the handler never calls Groq or the geocoder and
  uses neither the cooldown, nor the rate limit, nor the cap. It reads the state file without
  the lock (see D-4).

### D-4: Read-only state access (FR-12, AC-13, NFR-7)

`StateStore` gets `read(): Promise<StateData>`: no lock, no write. A lock-free read is safe
because every write is a temp file + `rename` (design 005 D-6). Errors become
`StateUnavailableError` as in `transact`. The result is passed through `pruneState` in memory
only, so after UTC midnight the cap counter and tokens read 0 without a write (AC-4, AC-9). A
polling reader therefore never competes with commands for the lock. `MemoryStateStore`
(`src/test/`) gets the same method.

### D-5: Endpoint guard (FR-15, AC-16)

`GET /api/metrics` only; every other method gets the same error shape (405). Browsers do not
send `Origin` on same-origin GET, so the command guard cannot be reused. Rule: `Sec-Fetch-Site`
must be `same-origin` (sent by all four supported browsers), and `Origin`, if present, must be in
`APP_ORIGIN`; anything else -> 403. No CORS headers, `Cache-Control: no-store`. All failures use
one shape without detail. It is not authentication: the figures are public (spec assumption),
the guard only keeps foreign pages from reading them in a browser. Config is read with `getEnv`
(so a broken env fails the request, shown as FR-13).

### D-6: Absolute times and clock skew (FR-6, FR-7, FR-8)

The snapshot carries `serverNow` and absolute epoch-ms reset times. The client computes an
offset `serverNow - Date.now()` at each response and uses `Date.now() + offset` for countdowns,
so a wrong device clock does not distort them. A countdown that reaches 0 turns the item into
"renewed, out of date" (FR-7) locally, no fetch is needed. The ticking clock runs once a second
only while a countdown is visible; the screen reader is told only when a countdown ends
(NFR-3, via a polite live region that is not updated each second).

### D-7: Visualisation – Base UI `Meter`, no chart library (FR-4, FR-8, NFR-3, NFR-4)

- **Choice:** `@base-ui/react/meter` (already installed, 1.9.0; types verified: `value`, `min`,
  `max`, `format`, `locale`, `getAriaValueText`, parts Label/Track/Indicator/Value). It gives
  `role="meter"` with name, value, min, max and a text equivalent. The bar is a Tailwind-styled
  track and indicator; its width change uses `TRANSITION_CLASS_NAME` (no motion with reduced
  motion). The "remaining / limit" text sits beside every bar, so meaning never rests on colour.
- **Alternatives considered:** hand-written SVG (would reimplement the ARIA contract for no
  visual gain: all bars are straight); chart libraries (tens of kB for four horizontal bars,
  and phase 1 has no chart). Phase 2 can add SVG or a library if a time series is wanted.
- **Concern:** `meter` is semantically a gauge, not a progress bar; that fits "amount left of a
  quota". A bar is not rendered at all for unknown values (FR-11): the item shows "no data".

### D-8: Formatting (FR-6, FR-16, AC-7, AC-17)

Pure functions with tests in `src/shared/timeFormatters.ts` (together with `formatEntryTime` of the
history tab, so every time text lives in one place):

- `formatCountdown(ms, locale)` rounds seconds up, carries 60 s into minutes (hours, days when
  large) and uses `Intl` for unit names (`Intl.DurationFormat` if the TS 6 lib types it, otherwise
  `Intl.NumberFormat` with `style: "unit"`). It serves the renewal times of the Groq limits.
- `formatClock(ms)` is a fixed "HHh MMm SSs" text, the same in every language (hours are not
  capped). It serves the time to the next UTC day under the cap.

Numbers use `Intl.NumberFormat` through a small local `formatCount` in `AiMetricsView.tsx`. The
locale comes from `useLocaleSwitch`, so a language switch re-renders without a fetch. The model
name is shown as is.

### D-9: Version and docs

Developer bumps 0.1.7 -> 0.1.8 (`npm version 0.1.8 --no-git-tag-version`), updates the README
and `.env.example` is unchanged (no new env).

### D-10: Layout and wording decisions after the implementation review

At the user's request, after reviewing the running tab, the layout and texts of the tab were
changed. They refine D-7 and D-8; the data, contract and behaviour are unchanged.

- **Order, top to bottom:** heading "AI" with the line "Model: <name>" on the same row, right
  aligned (model name small, label bold); "AI requests" (cap meter) with "Renewal in HHh MMm
  SSs"; "Last request (tokens)"; "Requests per day (Groq)" and "Tokens per minute" meters;
  "Tokens today (all users)"; a divider across the full width of the panel.
- **Last request:** a table with the columns Input / Output / Total (the Groq `prompt`,
  `completion` and `total` tokens) of equal width, left aligned, bold small headers and small
  values. The title says "(tokens)" so the numbers are not read as requests.
- **Dividers:** a normal `<hr />` closes the cap, the last request and the Groq limits; the last
  divider spans the full width of the side panel (it cancels the panel padding).
- **Text sizes:** smaller overall (base `text-sm`, secondary lines `text-xs`, model line 11 px);
  every meter label uses the style of the section headings; spacing between sections is halved.
- **Time to the next UTC day** under the cap is the fixed clock `formatClock` ("HHh MMm SSs");
  the renewal times of the Groq limits keep `formatCountdown`.
- **Czech wording:** "AI požadavky", "Poslední požadavek (tokeny)", "Požadavky za den (Groq)",
  "Tokeny za minutu", "Spotřeba tokenů dnes (všichni uživatelé)", "Model: …". The English "AI
  model" label became "Model" as well, since it sits under the "AI" heading.
- **Not done:** a cumulative total of tokens (as in the Groq console). Groq has no endpoint with
  the total; the Prometheus metrics endpoint gives rate series only and was not tried. An own
  counter would start from zero at deployment and miss use by other clients of the same key.

## Dependencies

| Package | Version | Purpose | Install / bundle size |
|---|---|---|---|
| none | - | Everything is native or already installed (`@base-ui/react` 1.9.0 `Meter`, Valibot 1.5.0, Zustand not needed) | 0 |

## Components

| Component | Responsibility | Folder |
|---|---|---|
| Groq answer parsing | `usage`, rate-limit headers, `parseGroqDuration`, `AiAnswer` | `src/server/ai/` |
| GroqClient (changed) | `observe`, `clock`; report every HTTP answer | `src/server/ai/` |
| Metrics recorder, figures | `AiFigures` (memory), recorder (tokens + figures), snapshot assembly | `src/server/metrics/` |
| State (changed) | `daily.tokens`, `addTokens` rule, `read()`, pruning | `src/server/state/`, `src/test/` |
| Metrics endpoint | Route (wiring), guard, handler, error shape | `src/app/api/metrics/`, `src/server/metrics/` |
| Services (changed) | Shared `AiFigures`, observer wired into `GroqClient` | `src/server/command/` |
| Shared contract | `MetricsResponse` types and Valibot schema | `src/shared/` |
| Metrics tab | Poller, clock offset, formatting, items, empty / partial / outdated states | `src/components/metrics/` |
| Panel tabs (changed) | Second definition `metrics` after `history` | `src/components/side-panel/` |
| Messages (changed) | `panel.tabs.metrics`, `panel.metrics.ai.*` (shared: `loading`, `loadFailed`, `outdated`, `noData`) | `messages/` |

Server modules import `server-only`; the poller, parsing and formatting are framework-free.

## Data flow

1. Command: pipeline as in design 005. `GroqClient` receives the HTTP answer, reads the body,
   builds `AiAnswer` and calls `observe` (not awaited, errors swallowed), then validates the
   output as before.
2. Recorder: `usage.total` valid -> `transact(addTokens)`; any valid limit / usage figure ->
   replace the in-memory figures (latest `receivedAt` wins). A store error is logged as a code
   only (never content) and dropped.
3. Browser: tab opens -> fetch -> validate with `metricsResponseSchema` -> render; poll while
   visible; a local one-second clock drives countdowns.
4. `GET /api/metrics`: guard -> `getEnv` -> `store.read()` -> prune in memory -> merge with
   `AiFigures` -> `{ ok: true, metrics }`. Any failure -> `{ ok: false, error }`.
5. Failure paths: fetch error, bad status or bad shape -> keep the last snapshot, mark it out
   of date, show the message, next poll retries; the rest of the panel is untouched.

## Interfaces

```ts
// src/server/ai/ - reported by GroqClient for every HTTP answer
export interface AiAnswer {
  receivedAt: number;                       // epoch ms, from Clock
  usage: { prompt: number | null; completion: number | null; total: number | null } | null;
  limits: {
    requests: { remaining: number | null; limit: number | null; resetsAt: number | null };
    tokens:   { remaining: number | null; limit: number | null; resetsAt: number | null };
  };
}
export type AiObserver = (answer: AiAnswer) => void;     // must not throw; client also guards
export function parseGroqDuration(value: string | null): number | null; // seconds

// src/server/metrics/
export interface AiFigures {                              // volatile part, in memory
  update(answer: AiAnswer): void;
  current(): { lastRequest: LastRequest | null; limits: LimitsFigures | null };
}
export interface AiMetricsRecorder { record(answer: AiAnswer): Promise<void> } // never rejects

// src/server/state/
export interface StateStore {
  transact<T>(fn: (s: StateData) => { next: StateData; result: T }): Promise<T>;
  read(): Promise<StateData>;               // new: no lock, no write
}
// StateData.daily: { day: string; count: number; tokens: number }

// src/shared/metricsContract.ts - validated with Valibot in the browser
export type LimitFigure = {
  remaining: number | null; limit: number | null; resetsAt: number | null;
};
export interface AiMetrics {
  model: string;                                          // GROQ_MODEL or default, as is
  dailyCap: { used: number; cap: number; resetsAt: number };   // UTC day, next midnight
  dailyTokens: number;                                    // since 00:00 UTC, all users
  lastRequest: { at: number; prompt: number | null; completion: number | null;
                 total: number | null } | null;           // null = nothing known yet
  limits: { receivedAt: number; requests: LimitFigure; tokens: LimitFigure } | null;
}
export interface MetricsSnapshot {
  serverNow: number;                                      // epoch ms
  ai: AiMetrics;                                          // phase 2 adds a sibling group
}
export type MetricsResponse =
  | { ok: true; metrics: MetricsSnapshot }
  | { ok: false; error: { code: "invalid_request" | "error" } };
```

`null` always means "no data"; a value is never replaced by 0 or 100 %. The requests limit is
per day and the tokens limit per minute: the contract names (`limits.requests`, `limits.tokens`)
carry no period and the period text lives in messages only; `dailyTokens` is the only token
total and is not derived from `limits.tokens`. HTTP: `ok` 200, `invalid_request` 403 / 405, `error`
500; all with `Cache-Control: no-store`. Messages: namespace `panel.metrics`, ICU for
numbers and durations; the developer names the keys.

Unchanged: `AiClient`, `AiResult`, `CommandResponse`, `PanelTabDefinition` (the second tab is
one list item, AC-25).

## External services

None added (NFR-1). No call to Groq is made to obtain figures: they come from answers to normal
commands. Env unchanged (`GROQ_MODEL`, `DAILY_CAP`, `APP_ORIGIN`, `STATE_DIR`).

## Error handling

- Missing, partial, negative, non-numeric or oversized `usage` / headers -> `null` per item,
  command unaffected (FR-11, NFR-6, AC-12, AC-20).
- Observer or recorder throws, store write fails, lock times out -> swallowed, logged as a
  code; the command's result and timing are unchanged (NFR-6).
- State file unreadable / invalid -> `error` response -> tab shows the failure message, last
  figures kept (FR-13, AC-14). The command flow already fails safe on the same condition.
- Wrong method, origin or fetch site -> uniform error, no figures (FR-15, AC-16).
- Browser: bad shape, network error, timeout -> out-of-date marker and retry (FR-13).
- Logs: code and duration only; the recorder never logs `AiAnswer` bodies, text, key or IP
  (FR-14, AC-15). `AiAnswer` holds numbers only, so nothing else can be stored.

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1 / AC-1, 25 | Panel tabs; T-8 |
| FR-2 / AC-2, 3 | D-2; T-2, T-4 |
| FR-3 / AC-4 | D-1, D-4; T-3, T-4 |
| FR-4, 5 / AC-5, 6 | D-2, D-7, contract; T-2, T-9 |
| FR-6, 7 / AC-7, 8 | D-2, D-6, D-8; T-2, T-7, T-9 |
| FR-8 / AC-9 | D-1, D-4; T-5, T-9 |
| FR-9 / AC-10 | `model` in snapshot; T-5 |
| FR-10, 11 / AC-11, 12 | `null` semantics, in-memory figures; T-4, T-9 |
| FR-12 / AC-13 | D-3, D-4; T-6, T-8 |
| FR-13 / AC-14 | D-3; T-6, T-9 |
| FR-14 / AC-15 | `AiAnswer` numbers only; T-2, T-5 |
| FR-15 / AC-16 | D-5; T-5 |
| FR-16 / AC-17 | D-8; T-7, T-10 |
| NFR-3, 4 / AC-18, 19 | D-6, D-7; T-9; manual |
| NFR-6 / AC-20 | D-2; T-2, T-4 |
| NFR-7 / AC-21 | D-1, D-4; T-3, T-4 |
| NFR-8 / AC-25 | `MetricsSnapshot` groups; T-1, T-8 |
| NFR-9, 10 / AC-22, 23 | T-9, T-11 (manual) |
| NFR-11 / AC-24 | T-2 to T-9 (fakes, fake clock) |

## Implementation plan

1. **T-1: Contract** – `metricsContract` types and Valibot schema in `src/shared/`. Done when:
   schema tests accept valid and reject malformed / extra-field data. Covers: NFR-8, AC-25.
2. **T-2: Groq answer parsing and observer** – `parseGroqDuration`, usage and header parsers,
   `AiAnswer`, `observe` in `GroqClient` (all statuses, before output validation, guarded).
   Done when: tests with stubbed `fetch` cover all duration formats of AC-7, garbage, negative,
   huge, 429 without `usage`, invalid output with `usage`, a throwing observer not changing the
   result. Covers: FR-2, 4, 6, 14, NFR-6, AC-2, 3, 7, 15, 20.
3. **T-3: State** – `daily.tokens` (default 0), `addTokens` rule, `pruneState`, `read()` on
   file and memory stores. Done when: tests cover old file without `tokens`, rollover, parallel
   `transact` (no lost or doubled tokens), read during a write, restart, corrupt file. Covers:
   FR-3, NFR-7, AC-4, 21.
4. **T-4: Recorder and figures** – `AiFigures`, recorder, wiring in `createServices`. Done when:
   tests (fake clock, memory store) show tokens added only for valid totals, latest wins,
   figures not wiped by header-less answers, store failure swallowed. Covers: FR-2, 3, 10, 11,
   NFR-6, 7, AC-2–4, 11, 12, 20.
5. **T-5: Endpoint** – guard, handler, snapshot assembly, route (GET only). Done when: handler
   tests cover fresh start (empty figures, cap and model present), rollover, cap reached, foreign
   `Sec-Fetch-Site` / `Origin`, other methods, no secrets, no Groq / geocoder / counter use.
   Manual `curl` is rejected, browser works. Covers: FR-8, 9, 12, 14, 15, AC-9–11, 15, 16.
6. **T-6: Client poller** – fetch + validation, offset, visibility-aware polling, out-of-date
   marker, retry. Done when: fake-timer tests cover first fetch, interval, hidden tab pause,
   failure keeps data, recovery. Covers: FR-12, 13, AC-13, 14.
7. **T-7: Formatting and messages** – `formatCountdown` and `formatClock` in
   `src/shared/timeFormatters.ts`, number formatting, `cs.json` /
   `en.json` keys (period labels, empty, no data, renewed, error, tab name). Done when: tests
   for both locales (60 s carry, hours, days) and the parity test pass. Covers: FR-6, 16, AC-7,
   17.
8. **T-8: Tab shell** – second entry in `PANEL_TABS`, empty content component. Done when: panel
   tests show tab order History, Metrics and unchanged open / close behaviour. Covers: FR-1,
   AC-1, 25.
9. **T-9: Metrics content** – last request, daily total, two limit items with `Meter`, cap with
   `Meter`, model, empty / partly known / outdated states, live countdown, FR-7 message,
   failure message; focus and motion classes from `sharedConstants`. Done when: component tests
   show AC-2, 5, 6, 8, 9, 11, 12, 14, 18 (meter name, value, min, max, text), the countdown
   not in a live region each second, no 0 / 100 % stand-ins. Covers: FR-2–11, 13, NFR-3, 4,
   AC-2, 5, 6, 8, 9, 11, 12, 14, 18, 19.
10. **T-10: Language** – verify switch re-renders text and numbers without fetch. Done when: a
    test switches locale with a stubbed client and sees no extra call. Covers: FR-16, AC-17.
11. **T-11: Docs, version, checks** – README (feature, structure, endpoint), version 0.1.8,
    `docs/architecture.md` check. Manual: AC-18 (keyboard, screen reader), AC-19, AC-22 (320 px
    to desktop, both orientations), AC-23 (four browsers), one real command and the tab shows
    live figures against real Groq headers. Done when: lint, typecheck, test, build green.
    Covers: AC-18, 19, 22, 23.

## Testing

Vitest, jsdom, no network. Server: stubbed `fetch` returning crafted bodies and headers,
`MemoryStateStore` + fake `Clock`; `FileStateStore` tests on a temp dir (parallel writers,
`read()` during writes, restart by creating a second store on the same directory). Handler
tests build `Request`s with and without `Sec-Fetch-Site` / `Origin`. Client: fake timers for the
poller and the countdown, stub `fetch`, `matchMedia` stub for reduced motion. Manual: see T-11.

## Risks / open questions

- Volatile figures show only the instance that handled the request if the app is ever run on
  several instances (see D-1); acceptable for the demo, fix is local to the recorder.
- `Sec-Fetch-Site` blocks non-browser clients and old browsers by design; only the latest four
  browsers are supported.
- The state file now has one more field; downgrade to an older build would reject it (strict
  schema). Not relevant before release.
- Groq may change header names or formats; parsing degrades to "no data" (NFR-6).
- Real free limits of the model may include a daily token limit (design 005 lists 200K TPD);
  the tab deliberately does not show one (FR-5). Suggest the user decides later, with the analyst.
- Public figures reveal usage patterns (spec risk); mention in the privacy notice TODO.
