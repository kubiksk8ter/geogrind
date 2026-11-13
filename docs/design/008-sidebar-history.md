# 008 – Side panel with command history (design)

- **Status:** Draft
- **Date:** 2026-11-11
- **Spec:** [008 – Side panel with command history](../specs/008-sidebar-history.md)
- **Next agent:** developer

## Summary

A small Zustand vanilla store keeps the history entries (a successful command's typed text, time
and server result). It mirrors them to session storage through a validating, quota-aware storage
module. A Base UI `Dialog` with `Tabs` renders the panel (modal and full screen below 768 px,
non-modal beside a narrowed map from 768 px). A re-run calls the same `moveMap` as a live result,
so no server code changes. The server API is not touched.

## Decisions

### D-1: State library – Zustand (FR-6, NFR-6, NFR-10)

- **Choice:** `zustand` (`createStore` from `zustand/vanilla` plus `useStore`). The store is
  created by a factory taking `{ storage, now, newId }`, provided by a React context provider
  mounted in `MapRoot` (client-only entry, `ssr: false`, so loading from session storage
  at creation causes no hydration mismatch). Tests inject fakes.
- **Alternatives considered:**
  - Redux Toolkit: 6.7 MB unpacked plus `react-redux`, `immer`, `reselect`, `redux-thunk`;
    far more machinery than one list and two actions.
  - Context + `useReducer`: no dependency and would work, but persistence needs effects in
    components, the logic is not testable outside React and every consumer re-renders (including
    the map view) when future tabs add state.
  - Zustand `persist` middleware: no per-entry validation, no quota trimming; rejected, our
    own storage module does it.
- **Rationale:** store logic and persistence (`subscribe`) live outside React; selectors limit
  re-renders; later slices (token usage) are added without touching existing ones.

### D-2: Entry shape and persisted envelope (FR-4, FR-14, NFR-6)

An entry is `{ id, at, text, result }`; `result` is the server's `CommandResult` (spec 005/007),
so its kind is `result.action` and a future action (route) adds a union member by itself. Stored
under one session-storage key as `{ version: 1, entries }`. On load the envelope is checked
loosely, then every entry separately with the same Valibot schema pieces as the server answer
(`commandResultSchema`, `isCleanCommandText`) plus a finite, valid-date `at`; invalid entries are
dropped, at most the newest 50 kept. Unknown version, bad JSON or a throwing `sessionStorage`
access -> empty history; the next successful save replaces the old data. Writes happen only when
`entries` changes (never for a re-run or the in-flight flag).

### D-3: Quota handling (FR-13, AC-5, AC-12)

Memory always keeps up to 50 entries. On a write failure (`QuotaExceededError` or any other) the
module retries with fewer entries, newest first, searching for the largest count that fits
(binary search, at most ~6 writes); if not even one fits, nothing is stored and the history stays
in memory for that page view. No error is shown. No compression (async `CompressionStream`
would complicate the synchronous write; revisit only if real use shows lost entries).

### D-4: Panel – Base UI Dialog + Tabs (FR-1–3, FR-11, FR-12, NFR-3, NFR-4)

- **Choice:** controlled `Dialog` (`modal` true below 768 px, false from 768 px, chosen by a
  `matchMedia("(min-width: 48rem)")` hook) and `Tabs`. Modal gives focus trap, outside content
  inert, Escape and focus return to the trigger for free (AC-15). Non-modal must not close on
  outside press (the user keeps working with the map); if the Dialog dismisses on outside press
  by default, disable that for the large layout (developer verifies the prop).
- **Tab extension (FR-3, AC-17):** one list of tab definitions; adding a tab = one list item plus
  its messages and content component. Opening, closing and layout never read the list contents.
  The panel title and tab labels come from messages by key.
- **Slide:** Tailwind starting/ending-style classes with the shared `TRANSITION_CLASS_NAME`
  (`motion-reduce:transition-none`), as in design 004.

### D-5: Layout and top-right corner (FR-1, FR-12, AC-18)

- Below 768 px the open panel is `fixed` full screen above everything.
- From 768 px the panel is fixed to the right edge with a limited width (constant in
  `sharedConstants.ts`) and the full-screen map `section` is narrowed by that width while the
  panel is open (`right` offset). MapLibre follows its container via `ResizeObserver`, so the
  zoom buttons, language switch, attribution and command input stay in the visible area and
  `fitBounds` targets the visible part; `MapEngine` is unchanged. The map width changes at once
  (no animated resize); only the panel slides.
- The panel control is rendered by a portal into `engine.controlsSlot`, below the language
  switch, so it stacks with the MapLibre controls, appears only when the engine exists (FR-15)
  and stays reachable beside an open panel on large screens. Target at least 44 px; alignment
  inside the 29 px control column is the developer's call.

### D-6: Re-run through the existing path (FR-8, FR-9, FR-15, AC-6–8)

`MapView` passes `showResult = moveMap` (same function the command input uses for live results;
`MapEngine.moveTo` already replaces the previous highlight and restarts the 30 s timer) to the
panel, or `null` while `engine` is null. The History tab calls it with `entry.result`. No client
or server call, no loading, cooldown or input state is touched. Entries are disabled while the
store flag `commandInFlight` is true, which `useCommandInputController` sets when a request
starts and clears when it ends or the controller unmounts. On a small screen the tab then asks
the panel to close.

### D-7: Adding an entry (FR-4, FR-5, FR-10)

`useCommandInputController` gets one more callback, `onSuccess(text, result)`, called right after
`onMove` in the `response.ok` branch only; failure branches, `wait` and the not-ready map path
never call it. `MapView` wires it to the store's `addEntry`, which stamps `at = now()`, creates
an id, prepends, trims to 50 and lets the persistence subscriber write.

### D-8: Time display (FR-7, AC-3, AC-14)

Pure `formatEntryTime(at, now, locale)` over `Intl.DateTimeFormat`: time only when `at` is on the
same local calendar day as `now`, otherwise date and time. The list reads the locale from
`useLocaleSwitch`, so a language switch re-renders it. The label is stale only if the panel
stays open across midnight; accepted.

### D-9: Version and docs (versioning policy)

Developer bumps 0.1.6 -> 0.1.7 in `package.json` and `package-lock.json`
(`npm version 0.1.7 --no-git-tag-version`) and updates the README.

## Dependencies

| Package | Version | Purpose | Install / bundle size |
|---|---|---|---|
| zustand | 5.1.0 | Global history store (vanilla store + React hook) | 112 KB unpacked, MIT, no dependencies, bundled types; bundle size not measured, check after build |

Peers (`react`, `@types/react`) are already installed; `immer` and `use-sync-external-store`
peers are optional and not needed. Everything else (Dialog, Tabs, Intl, `sessionStorage`) is
already in the stack or native. Verify the exact version with `npm view zustand version` before
install.

## Components

| Component | Responsibility | Folder |
|---|---|---|
| History store | Store factory, `addEntry`, `commandInFlight`, provider and hooks | `src/components/history/` |
| History storage | Load with validation, save with quota trimming, entry schema | `src/components/history/` |
| Side panel | Dialog, tabs list, open/close, small/large behaviour, control | `src/components/side-panel/` |
| History tab | Entry list, empty message, time formatting, activation | `src/components/history/` |
| MapView (changed) | Provider wiring, `showResult`, `onSuccess`, narrowed map, control portal | `src/components/map/` |
| Command controller (changed) | `onSuccess` callback, `commandInFlight` flag | `src/components/command-input/` |
| Messages (changed) | `panel.*` texts in Czech and English | `messages/` |

## Data flow

1. Successful command: controller gets `response.ok` -> `onMove(result)` (as before) ->
   `onSuccess(text, result)` -> `addEntry` -> state updates -> subscriber saves to session
   storage (trimmed on quota failure, silent).
2. Page load: store factory reads the key, validates entry by entry, starts with the valid ones.
3. Re-run: entry click -> `showResult(entry.result)` -> `moveMap` -> `engine.moveTo`; on a small
   screen the panel closes afterwards and focus returns to the control. Disabled while
   `commandInFlight` or no engine.
4. Failure of any kind in step 1 -> no `onSuccess`, nothing stored (FR-5).

## Interfaces

```ts
// src/components/history/
export interface HistoryEntry {
  id: string;
  at: number;          // epoch ms, valid date
  text: string;        // normalised text the user typed, max 200 code points
  result: CommandResult; // from @/shared/actions
}

export interface HistoryStorage {
  load(): HistoryEntry[];                 // never throws; invalid entries dropped
  save(entries: readonly HistoryEntry[]): void; // never throws; stores what fits
}

export interface HistoryState {
  entries: readonly HistoryEntry[];       // newest first, at most 50
  commandInFlight: boolean;               // memory only, not persisted
  addEntry(text: string, result: CommandResult): void;
  setCommandInFlight(value: boolean): void;
}
export function createHistoryStore(deps: {
  storage: HistoryStorage; now(): number; newId(): string;
}): StoreApi<HistoryState>;

// src/components/side-panel/ – contract between panel and its tabs
export interface PanelTabDefinition {
  id: string;
  labelKey: string;                       // key in messages "panel.tabs.*"
  Content: ComponentType<PanelTabContentProps>;
}
export interface PanelTabContentProps {
  /** Null while the map is not ready. */
  showResult: ((result: CommandResult) => void) | null;
  /** Called after an activation; the panel closes itself on small screens only. */
  onActivated(): void;
}
export function formatEntryTime(at: number, now: number, locale: Locale): string;
```

Persisted envelope: `{ version: 1; entries: HistoryEntry[] }` under one session-storage key.
Controller addition: `onSuccess?: (text: string, result: CommandResult) => void`.

## External services

None. NFR-1: no new service, no server code, nothing leaves the browser (NFR-5).

## Error handling

- Session storage missing, throwing, full, corrupt, wrong version -> memory only or partial
  save, no message, bad data replaced at the next save (FR-13, AC-12).
- Invalid or out-of-range stored entry -> dropped silently (FR-14).
- Map not ready -> no control, entries disabled (FR-15, AC-13).
- Request in flight -> entries disabled (FR-9, AC-8).

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1, 2, 3 / AC-1, 17 | D-4, D-5; T-4, T-5 |
| FR-4, 5, 10 / AC-3, 4, 9 | D-2, D-7; T-2, T-3 |
| FR-6, 13, 14 / AC-5, 12 | D-1, D-2, D-3; T-2 |
| FR-7 / AC-2, 3 | D-8; T-5 |
| FR-8, 9 / AC-6, 7, 8 | D-6; T-3, T-5 |
| FR-11, 12 / AC-10, 11, 18 | D-4, D-5; T-4 |
| FR-15 / AC-13 | D-5, D-6; T-4 |
| FR-16 / AC-14 | T-6 |
| NFR-3, 4 / AC-15, 16 | D-4; T-4; manual |
| NFR-6, 10 / AC-19 | D-1, D-2; T-1, T-2 |
| NFR-9 / AC-20 | manual (T-7) |

## Implementation plan

1. **T-1: Setup and store** – install `zustand`; store factory with `addEntry`, 50 limit, flag,
   provider and hooks; unit tests with fake storage and clock. Done when: tests, lint,
   typecheck green. Covers: FR-4, FR-10, FR-13 (limit), NFR-10.
2. **T-2: Persistence** – entry schema, `HistoryStorage` on `sessionStorage` (load validation,
   quota trimming, throwing storage), subscriber. Done when: tests cover corrupt JSON, wrong
   version, invalid and out-of-range entries, bad `at`, full storage keeping the newest that fit,
   throwing access. Covers: FR-6, 13, 14, AC-5, 12.
3. **T-3: Command wiring** – `onSuccess` and `commandInFlight` in the controller; `MapView`
   wires `addEntry`. Done when: tests show entries only after success, none for any failure,
   `wait` or missing map, flag set during a request. Covers: FR-4, 5, 9, AC-4, 8, 9.
4. **T-4: Panel shell** – Dialog (modal/non-modal by breakpoint), tab list with one History
   definition, close control, control portaled into `controlsSlot`, narrowed map from 768 px,
   slide with reduced-motion opt-out. Done when: component tests (mocked `matchMedia`) cover
   open/close/Escape, no control without engine, small-screen close after activation, large
   stays open. Covers: FR-1–3, 11, 12, 15, NFR-3, 4, AC-1, 10, 11, 13, 17.
5. **T-5: History tab** – list newest first, typed text, `formatEntryTime`, empty message,
   activation via `showResult` (disabled when null or in flight). Done when: tests show
   re-run calls `moveTo` with the stored result, no `fetch`, input text and cooldown untouched,
   order unchanged. Covers: FR-7–10, AC-2, 3, 6, 7, 9.
6. **T-6: Messages** – `panel.*` keys in `cs.json` and `en.json` (control, panel and tab names,
   close, empty, list name); parity test passes. Covers: FR-16, AC-14.
7. **T-7: Docs, version, checks** – README (feature list, structure, Zustand), version 0.1.7,
   manual checks listed below. Done when: lint, typecheck, test, build green. Covers: AC-15, 16,
   18, 20.

## Testing

Vitest with jsdom and Testing Library; no network. Store and storage: fake `Storage` (Map-based,
configurable to throw or hit quota) and fake clock. `formatEntryTime` for cs and en, same day
vs earlier. Component tests: stubbed command client and fake `MapEngine` (`moveTo` spy),
`matchMedia` stub for small/large and reduced motion.

Manual (T-7): AC-15 keyboard and screen reader; AC-16 reduced motion; AC-18 widths 320 px to
desktop in both orientations (check 768 px: map width, `ResizeObserver` resize, `fitBounds`
into the visible part, no page scrollbar); Escape closes the large-screen panel when focus is
in the map; large geometry (many highlighted entries) near quota; AC-20 in four browsers.

## Risks / open questions

- Resizing the map when the panel opens may flicker on slow devices; fallback is to let the
  panel cover the map and offset the engine padding instead.
- Many 5,000-position highlights can exceed session storage; the oldest then disappear after a
  reload (accepted in FR-13). Compression is the next step if it matters.
- `crypto.randomUUID` needs a secure context; `newId` is injectable, the developer picks a
  generator that works on plain `http://localhost` and https.
- Privacy notice should mention that typed text stays in session storage until the tab closes.
