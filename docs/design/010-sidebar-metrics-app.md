# 010 – Side panel "Metrics" tab, phase 2: Application (design)

- **Status:** Draft
- **Date:** 2026-11-16
- **Spec:** [010 – Side panel "Metrics" tab, phase 2: Application](../specs/010-sidebar-metrics-app.md)
- **Next agent:** developer

## Summary

The command handler reports one measurement per processed command to a recorder. The recorder
keeps the hour window in memory and adds the result to the day's counts in the state file. The
geocoder reports each real HTTP attempt to an in-memory status holder. `GET /api/metrics` gets a
sibling group `app` next to `ai` (unchanged). The map light is computed in the browser from
MapLibre tile events and reaches the tab through a React context. Pie and sparkline are
hand-written SVG; no new package. Every FR, NFR and AC of spec 010 is covered by the decisions
and tasks below.

## Decisions

### D-1: Where the figures live

- **Persistent** (state file, `daily.results` beside `count` and `tokens`): today's count per
  result. Same UTC rollover (`pruneState`), lock and atomic rename; own `transact` per command
  (`addResult` rule); `optional(..., zeros)` so an old file stays valid.
- **In memory** (`globalThis` singletons): the hour window (D-4) and the Nominatim status (D-5).
- **Derived on read:** commands in progress = clients with a live `inflightUntil`.
- **Restart:** the pie stays a full day (persisted), so it needs no label. Hour figures are
  partial: the snapshot carries `window.startedAt`, and the UI adds "since start" to last hour,
  active clients and latency while `serverNow - startedAt < window.durationMs`.
- Rejected: day counts only in memory (wrong after each restart); persisting the window (stale in
  minutes); SQLite / Redis (new dependency for one instance).

### D-2: One measuring point in the command handler

`handle()` already has the result code and `durationMs` for its log line. There it calls the new
dep `measurement(entry)` (sync, wrapped in `try/catch`, result ignored); `process()` stores the
resolved client id in `report`. `invalid_request` is not measured; `ok: true` maps to `success`.
`createCommandMeasurement` records into the window and runs `void store.transact(addResult)`; errors are logged as
a code only. It is wired in the route from `getEnv()` + `createStateStore`, not `createServices`,
so commands failing early (missing client address) still count as `error`. `RESULT_KEYS` in the
contract has a compile-time check against `COMMAND_ERROR_CODES`. The latency set is all counted
results except `wait` and `too_many_requests` (instant rejections that never reach the AI;
user decision); they still count in the pie and in the load figures.

### D-3: Active clients without identifiers

Each window record holds a digest of the client id: HMAC-SHA-256 with a random per-process key
(`node:crypto`), truncated to at least 64 bits. The raw id and key never leave the recorder; the
digest is memory-only, never written, logged or sent. Active clients = distinct digests in the
last hour. See Risks.

### D-4: Window, percentiles, sparkline

- `CommandWindow`: fixed-capacity ring buffer of `{ at, durationMs, result, client }`, injected
  `Clock`; overflow drops the oldest, reads ignore records older than 60 min. Window length and
  bucket width are exported in the snapshot, not hard-coded in the UI.
- Median and p95 by nearest rank, `sorted[ceil(p * n) - 1]`; no minimum count; `n = 0` ->
  `latency: null`.
- Sparkline: 12 buckets of 5 min up to `now`, oldest first, value = bucket median, `null` for an
  empty bucket (placed at 0 so the line starts and ends on the bottom line; stretches that touch an empty bucket are dotted, only those between real values are solid; user decision; the text equivalent counts real values only).
- Until a command is recorded after start, `lastHour` and `activeClients` are `null`; afterwards
  numbers (labelled "since start" while partial). `lastMinute` and `inProgress` are always
  numbers.

### D-5: Nominatim status from the geocoder

`NominatimOptions.observe?: (available: boolean) => void`, called once per real HTTP attempt in
`search()` (after the spacer): `true` for 2xx with the expected shape (including "no result"),
`false` for network error, abort / timeout, non-2xx (429, 5xx) or bad shape. Cache hits and
commands that never reach the geocoder do not report. It writes to `ServiceStatus`
(`globalThis`, `null` until the first report and after a restart), wired in `services.ts`.
Deviation from the brief: the handler cannot tell a cache hit from a call or a failure from an
abort while queued; the geocoder can.

### D-6: Map status in the browser

- `createTileAvailability({ failureThreshold, onChange })` in `src/map/`, fed by the engine with
  tile success (`sourcedata` with `tile`) and tile error (`error` with `tile`; style, glyph and
  sprite errors and 404 tiles are ignored). States `unknown | available | unavailable`.
- `unknown` until `load` / the first tile success. Unavailable after N consecutive tile errors
  with no success between (N is the developer's choice, e.g. 3); one error never turns it red;
  any tile success returns to available at once. Event shapes are to be checked against
  `maplibre-gl` 6.16.0 types.
- `MapEngineOptions.onAvailabilityChange`; `MapView` keeps it in state (reset to `unknown` when
  the engine is recreated) and provides it via `MapAvailabilityContext`; `MetricsTab` reads it.
  Context, not props, so `SidePanel` and `PanelTabContentProps` stay unchanged.
- Rejected: a Zustand store (more than one enum needs); a probe request (breaks "no extra calls").

### D-7: Delivery and refresh

Unchanged from design 009 D-3 to D-5: same endpoint, guard, poller, 10 s interval, visibility
rules and out-of-date marker; a failed fetch keeps both groups, the map light does not depend on
it. Reading never calls `record`, `report`, Groq or the geocoder and takes no limit.

### D-8: Charts in hand-written SVG (no library, user decision)

Pure, tested geometry: `pieSlices(counts)` (one 100 % slice is a full circle, since an arc to
its own start draws nothing; zero slices omitted from the pie but kept in the legend; total 0 ->
no pie) and `sparklinePath(series)` (`null` is placed at 0 and drawn dotted, one point is a dot). Colours only, no
patterns or hatching (user decision after review): success green, "unsupported" and "not found" lighter
greens (much lighter, below 3:1 against white by the user's choice; swatches have a grey outline),
then yellow ("wait"), orange, red and dark red ("error"), shared by slice and legend swatch,
white slice strokes, and legend rows with name, count and percentage. Lights are plain dots (green, red, grey
while unknown; no icons, user decision) with a text label and `title`. Pie and sparkline have an accessible
name and a text equivalent (all counts; median, p95, count, span). No animation. Percentages are
whole numbers via `Intl`, no sum correction; `formatDuration(ms, locale)` joins
`src/shared/timeFormatters.ts`.

### D-9: Layout, later logging, version

- Layout as 009 D-10: heading "Application" like "AI", `text-sm` base, `text-xs` secondary,
  `<hr />` between items, no trailing divider after the last item (the AI group's full-width
  divider separates the groups). Order: results (legend beside the pie, below when narrow),
  latency, load, services.
- Later `.data/logs.json` error logging attaches at `createCommandMeasurement` and `ServiceStatus.report`;
  snapshot and tab need no change. Not built.
- Developer bumps 0.1.8 -> 0.1.9 (`npm version 0.1.9 --no-git-tag-version`) and updates the
  README. No new env.

## Dependencies

| Package | Version | Purpose | Install / bundle size |
|---|---|---|---|
| none | - | `node:crypto`, MapLibre 6.16.0, Valibot 1.5.0, `Intl` already available | 0 |

## Overview

| Part | Change | Folder |
|---|---|---|
| Contract | `RESULT_KEYS`, `AppMetrics`, `app` in the snapshot schema | `src/shared/` |
| State | `daily.results`, `addResult`, pruning (test literals too) | `src/server/state/`, `src/test/` |
| Window, status, recorder | `CommandWindow`, `ServiceStatus`, `createCommandMeasurement`, snapshot `app` | `src/server/metrics/` |
| Command handler / route | `deps.measurement` called once per processed command | `src/server/command/`, `src/app/api/` |
| Geocoder | `observe` per HTTP attempt; wiring | `src/server/geocoding/`, `src/server/command/` |
| Map | `createTileAvailability`, engine option, `MapAvailabilityContext` | `src/map/`, `src/components/map/` |
| Metrics tab | Application view, chart geometry, partial / empty states | `src/components/metrics/` |
| Messages | `panel.metrics.app.*` | `messages/` |

Flow: command -> `handle()` -> `measurement` (window + `addResult`); geocoder HTTP attempt ->
`ServiceStatus`; poll -> `GET /api/metrics` (`store.read()`, prune, `ai` + `app`) -> `MetricsTab`
shows `AiMetricsView` then the Application view with the context's map state. Failures: `measurement`
and `observe` errors are swallowed (code logged, command unchanged); unreadable state or a bad
shape = failed fetch (last figures kept, marked out of date); guard rules as in 009. Logs hold
codes, durations and error names only.

## Interfaces

```ts
// src/shared/metricsContract.ts (Valibot strict schemas; `ai` unchanged)
export const RESULT_KEYS = [
  "success", "unsupported", "not_found", "wait", "too_many_requests", "ai_resting", "error",
] as const;
export type ResultKey = (typeof RESULT_KEYS)[number];
export interface AppMetrics {
  results: Record<ResultKey, number>;                                   // today UTC, persisted
  window: { startedAt: number; durationMs: number; bucketMs: number };
  load: { lastMinute: number; lastHour: number | null;
          activeClients: number | null; inProgress: number };
  latency: { count: number; medianMs: number; p95Ms: number;
             series: (number | null)[] } | null;                        // null = no data
  services: { nominatim: boolean | null };                              // null = unknown
}
export interface MetricsSnapshot { serverNow: number; ai: AiMetrics; app: AppMetrics }

// src/server/metrics/
export interface CommandMeasurement {
  result: ResultKey; durationMs: number; clientId: string | null;  // raw id, digested at once
}
export type CommandMeasurementRecorder = (entry: CommandMeasurement) => void;  // never throws
// CommandHandlerDeps gains: measurement: CommandMeasurementRecorder
// StateData.daily gains: results: Record<ResultKey, number>   (default zeros)

// src/server/geocoding/ - NominatimOptions gains:
observe?: (available: boolean) => void;                            // guarded by the geocoder

// src/map/types.ts
export type MapAvailability = "unknown" | "available" | "unavailable";
// MapEngineOptions gains: onAvailabilityChange(availability: MapAvailability): void
```

## Implementation plan

1. **T-1: Contract** – `RESULT_KEYS`, `AppMetrics`, `app` in the schema, updated fixture. Done
   when: schema tests accept valid and reject malformed / extra fields; coverage check compiles.
2. **T-2: State** – `daily.results`, `addResult`, pruning. Done when: tests cover an old file,
   rollover, parallel writers and a restart that keeps counts.
3. **T-3: Command window** – ring buffer, summary, percentiles, buckets, digests, partial rule.
   Done when: fake-clock tests cover 20 commands, one command, empty, older than 60 min, 30 s /
   5 min / 50 min, 3 clients, `null` after start, bounded memory, no raw id in any output.
4. **T-4: Nominatim status** – `ServiceStatus`, `observe`, wiring. Done when: stubbed-`fetch`
   tests show true on 2xx and "no result"; false on network error, abort, 429, 5xx, bad shape;
   no report on a cache hit or an uncalled geocoder; unknown at start.
5. **T-5: Measuring point** – `measure`, `deps.measurement` in the handler, route wiring. Done when:
   one measurement per processed result, none for `invalid_request`, unchanged response and
   timing with a throwing `measurement`, counts reach the store.
6. **T-6: Snapshot and endpoint** – `app` group, in-progress count, services in
   `MetricsServices`. Done when: tests show a fresh start, in progress 1 -> 0, repeated reads
   changing nothing and calling no service, a foreign origin rejected.
7. **T-7: Map availability** – `createTileAvailability`, engine events, `MapView` state,
   context and hook. Done when: tests cover unknown -> available, one error ignored, N errors ->
   unavailable, success -> available, 404 ignored, context follows the engine without `fetch`.
8. **T-8: Formatting and messages** – `formatDuration`, `panel.metrics.app.*` in both languages.
   Done when: formatter tests for both locales and the message parity test pass.
9. **T-9: Chart geometry** – `pieSlices`, `sparklinePath`. Done when: tests cover 60/20/10/10,
   100 % as a full circle, zero slices, total 0, gaps, one point.
10. **T-10: Application view** – pie with legend, latency, load, lights, empty /
    partial states, text equivalents, shared focus and motion classes. Done when: component
    tests show counts, non-colour cues, no stand-in 0 / 100 %, "since start", Nominatim
    unknown sentence.
11. **T-11: Tab wiring** – render after `AiMetricsView`, map light from the context, one
    out-of-date banner. Done when: a locale switch triggers no fetch; a failed fetch keeps the
    figures and the map light still changes.
12. **T-12: Docs, version, checks** – README, 0.1.9. Done when: lint, typecheck, test, build are
    green; manual: keyboard, screen reader, reduced motion, 320 px to desktop in both
    orientations, four browsers, blocked tile host in DevTools turns the light red and back.

## Testing

Vitest, jsdom, no network. Server: window and recorder with `fakeClock` and `MemoryStateStore`;
`FileStateStore` on a temp dir for restart and parallel writes; handler tests with stub services
and a spy `measurement`; geocoder with stubbed `fetch`. Client: pure geometry and availability
tests, component tests with Testing Library and a `matchMedia` stub. Manual checks as in T-12.

## Risks / open questions

- The client digest is a per-process pseudonym kept in memory only; accepted by the owner.
- A burst above the ring capacity within an hour silently undercounts the hour figures.
- Day counts start at deployment, so commands earlier that UTC day are missing once.
- The map light changes only when tiles are requested; an idle offline map keeps its state.
- Nominatim status can be old, and several instances would each show their own memory state.
