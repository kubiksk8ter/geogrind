# 003 – Command input field and CZ/EN language switch (design)

- **Status:** Draft
- **Date:** 2026-11-02
- **Spec:** [003 – Command input and language switch](../specs/003-user-input-and-language-switch.md)
- **Next agent:** developer

## Summary

The locale becomes client state: a client `LocaleProvider` (wrapping next-intl's provider, with
both message catalogues bundled) replaces the server-side provider. Switching language calls
`history.replaceState` to `/cs` or `/en`, updates `<html lang>` and the locale cookie (Cookie
Store API), and re-renders in place, so there is no navigation and the map is never recreated.
The language switch is rendered by React into a slot that the map engine adds to MapLibre's
top-right control stack (stacked below the zoom buttons, options the size of the zoom buttons);
the collapsible attribution sits top-left; the command input is a React overlay inside `MapView`
at the bottom edge. Both controls are built with Base UI (`@base-ui/react`), the UI library chosen
for the future side panel.

## Decisions

### D-1: UI library – Base UI (FR-14, AC-12, AC-13)

- **Choice:** `@base-ui/react` 1.9.0 (MIT, unstyled, bundled types, `sideEffects: false`,
  per-component imports such as `@base-ui/react/tabs`). Stable since 1.0 (Dec 2025). Free of
  charge, no account or paid tier (NFR-1). Styling is Tailwind classes plus `data-*` state
  attributes, so it needs no extra CSS system.
- **Fit for the planned side panel:**
  - Tabs: `Tabs` (Root, List, Tab, Panel, Indicator).
  - Layer toggling: `Switch` or `Checkbox` per layer (verified to exist in the component list).
  - Monthly usage: `Meter` shows the current month's usage within its range, with a formatted
    value and an accessible value text. The token reset time is plain text formatted with
    next-intl's `useFormatter` (Intl, both languages). A history chart is not a UI-library
    concern, see D-2.
  - This spec: `RadioGroup` + `Radio` for the language switch (single choice, selected state as
    `data-checked`) and `Input` for the command field. Group/field names come from messages.
- **Alternatives considered:**
  - Radix UI (`radix-ui` 1.8.1, MIT): not deprecated, but its authors' newer work is Base UI and
    shadcn/ui made Base UI its default for new projects (secondary sources, July 2026).
  - React Aria Components 1.22.1 (Apache-2.0, ~6.9 MB): excellent accessibility, but ships its
    own i18n/locale layer that would have to be kept in sync with next-intl; heavier.
  - Headless UI 2.2.10 (MIT): no `Meter`, smaller component set.
  - No library (hand-written primitives): rebuilding tabs/radio keyboard behaviour and ARIA is
    the main accessibility risk (NFR-3) for no gain.
- **Concerns (minor):** 10.4 MB unpacked, but tree-shakable; the bundle cost of the components
  used was not measured (check in T-6). Docs for some components do not describe keyboard
  behaviour in detail; verify manually (AC-14). Its popups use portals and recommend
  `isolation: isolate` on the app root; irrelevant now, revisit with the side panel.

### D-2: Chart for the future panel – no chart library chosen now

- **Choice:** Do not add a chart dependency in this spec. The panel spec should start with a
  small hand-written SVG bar chart (one bar per month, a marker or text for the reset time).
- **Alternatives considered:** Recharts 3.10.1 (MIT, ~7.5 MB unpacked, pulls redux and
  es-toolkit) – heavy for a handful of bars; reconsider only if charts become complex.
- **Rationale:** Simplest thing that meets the spec; FR-14 only asks that the approach fits.

### D-3: Language switching without navigation (FR-7, FR-8, NFR-6)

- **Problem:** `[locale]` is the root layout (`next/root-params`), so a router navigation
  between `/cs` and `/en` is a full page load: the map would reload and lose its view.
- **Choice:** Locale is client state initialised from the server locale. `setLocale(next)`:
  1. updates state (re-renders in place, nothing is remounted or keyed by locale);
  2. `window.history.replaceState(null, "", localizedPath(current URL, next))` – the Next.js
     docs show exactly this pattern for locale switching and say it syncs with `usePathname`;
  3. sets `document.documentElement.lang`;
  4. writes the `NEXT_LOCALE` cookie (next-intl's cookie, session cookie, `path=/`,
     `SameSite=Lax`) with `cookieStore.set(localeCookie(next))` (Cookie Store API), so `/` keeps
     redirecting by the last choice, as before. A rejected promise is ignored.
- **Alternatives considered:** `router.push` / next-intl `useRouter` (full reload, breaks
  FR-8); moving the map above `[locale]` (the `[locale]` root layout would still reload and
  typed text would be lost); pushState with history entries (forward/back would trigger a real
  navigation and remount).
- **Rationale:** One small provider, no route restructuring; back/forward leave the page as
  they would after any in-page state change.
- **Cookie via Cookie Store API, not `document.cookie`:** Biome forbids assigning
  `document.cookie`. `cookieStore.set` is async, needs no string building and is available in
  the supported browsers (Chrome/Edge 87+, Firefox 140+, Safari 18.4+ per MDN/caniuse), so no
  fallback is written. `localeCookie` returns a `CookieInit` object. Tests stub `cookieStore`
  (jsdom lacks it).
- **Concerns:** Both catalogues ship to the client (a few lines of JSON now; revisit if they
  grow large). Server components must not rely on the locale after a switch (none do:
  title is the `APP_NAME` constant). Verify early (T-2) that Next 16.4 does not refetch on
  `replaceState` to a path of another root-layout value.

### D-4: Switch placement – React portal into a MapLibre control slot (FR-6)

- **Choice:** The engine adds a custom `IControl` (after `NavigationControl`) whose element is
  exposed as `controlsSlot`. `MapView` renders `LanguageSwitch` into it with `createPortal`
  (context, so messages and locale, still work). The switch sits directly below the zoom group
  in MapLibre's top-right stack (user decision: below, not beside). No layout CSS is needed:
  MapLibre stacks controls of a corner vertically in the order they were added. Its options
  are the size of the zoom buttons (29 px, `size-7.25`) so the column is uniform (spec user
  decision 3).
- **Alternatives considered:** Absolutely positioned overlay under the zoom buttons – couples
  our CSS to MapLibre's control size and margins and breaks if either changes.
- **Rationale:** MapLibre keeps control layout, spacing and attribution clearance at every
  viewport size; the groups stay together (FR-6, NFR-4). Tab order is zoom, switch, input
  (AC-14). The slot disappears with the map, so the failure state shows no switch (FR-13).

### D-5: Command input and placeholder rotation (FR-1–5, FR-9, FR-11)

- **Choice:** Base UI `Input` (native `<input>`) in an overlay inside `MapView`'s non-failed
  branch, bottom centre close to the bottom edge (offset is the larger of a small gap and the
  bottom safe-area inset), sibling of the map container (map gestures never see it). The hint is
  the native `placeholder` attribute, accessible name via `aria-label` from messages. Rotation
  is a hook with an interval timer, paused while the value is non-empty. Hint index is plain
  state that survives locale changes, so the same position continues in the new language.
- **Hint source:** an ordered list of message keys (`PLACEHOLDER_KEYS`) in code
  (`placeholderConstants.ts` next to `CommandInput`, together with `ROTATION_INTERVAL_MS`); texts
  in `cs.json`/`en.json` (arrays are awkward in typed next-intl messages).
- **Rationale:** A native placeholder is not announced when it changes and has no animation,
  which satisfies AC-16 and reduced motion without extra code. Enter does nothing because
  there is no form and no key handler (FR-2).
- **Constraints for the developer:** font size ≥ 16 px (iOS Safari zooms the page on focus
  otherwise, NFR-7); the input is 44 px high (NFR-7) and uses most of the width on narrow screens
  (NFR-4). It no longer needs to avoid the attribution (moved, D-7).

### D-6: Visible "CZ"/"EN" labels are constants

- **Choice:** `{ cs: "CZ", en: "EN" }` lives in `src/i18n/`, not in messages (like `APP_NAME`);
  accessible names ("Čeština"/"Czech", …) are messages. Satisfies NFR-2 by construction.

### D-7: Attribution top-left (FR-15, spec user decision 4)

- **Choice:** The engine disables the built-in attribution (`attributionControl: false`) and adds
  MapLibre's `AttributionControl` explicitly at `"top-left"` (collapsible behaviour and text
  unchanged). `globals.css` caps the control's `max-width` (viewport width minus the right-hand
  control column and margins) so an expanded attribution never reaches the zoom buttons and
  switch at 320 px.
- **Alternatives considered:** Custom attribution UI – duplicates MapLibre, risks licence text.
- **Rationale:** Frees the bottom edge for the input; attribution stays visible (spec 002 FR-9).
- **Concerns:** The top-left corner may be wanted by the future header.

### D-8: Shared class-name constants

- **Choice:** Tailwind class sets used by several components live in
  `src/components/sharedConstants.ts`: `FULL_SCREEN_CLASS_NAME` and `FOCUS_RING_CLASS_NAME`.

## Dependencies

| Package | Version | Purpose | Install / bundle size |
|---|---|---|---|
| @base-ui/react | 1.9.0 | Unstyled accessible components (Radio, Input now; Tabs, Meter, Switch later) | 10.4 MB unpacked; tree-shakable, bundle not measured |

No `@types/*` needed (bundled types; `@types/react` already present). No chart package.

## Components

| Component | Responsibility | Folder |
|---|---|---|
| LocaleProvider | Client locale state, wraps next-intl provider with both catalogues, `setLocale` side effects | `src/i18n/` |
| Locale helpers | Pure `localizedPath`, `localeCookie` (`CookieInit`), visible labels | `src/i18n/` |
| Locale layout | Passes the server locale to `LocaleProvider` instead of the server provider | `src/app/[locale]/` |
| Attribution styling | Max-width cap for the expanded top-left attribution | `src/app/` (`globals.css`) |
| MapEngine (extended) | Adds `controlsSlot` via custom `IControl`; attribution at top-left | `src/map/` |
| Map feature | `MapView` (renders `CommandInput`, portals `LanguageSwitch`), `MapLoader`, `MapFailure`, `MapLibreMapView` | `src/components/map/` |
| LanguageSwitch | Base UI `RadioGroup` with CZ/EN options | `src/components/language-switch/` |
| CommandInput | Base UI `Input`; `PLACEHOLDER_KEYS`, `ROTATION_INTERVAL_MS`, `usePlaceholderRotation` beside it, no `index.ts` | `src/components/command-input/` |
| Shared constants | `FULL_SCREEN_CLASS_NAME`, `FOCUS_RING_CLASS_NAME` (replaces `styles.ts`) | `src/components/` |
| Messages | `input.*`, `language.*` keys in both languages | `messages/` |

One folder per feature under `src/components/`; each holds its component(s) and tests.

## Data flow

1. `/cs` or `/en` renders on the server; `LocaleProvider` receives the server locale as
   `initialLocale` and renders next-intl's provider with that locale's messages.
2. `MapView` creates the engine once (unchanged). The engine adds the zoom control and then the
   slot control; `MapView` stores the slot and portals `LanguageSwitch` into it.
3. User selects the other language → `setLocale` (D-3) → context updates → all
   `useTranslations` consumers re-render. `MapView`'s effect depends on `createEngine` and the
   failure flag only, so the engine is neither destroyed nor recreated; the map view and the
   input's value are untouched; the rotation index continues.
4. Selecting the active language → `setLocale` returns early (FR-10).
5. Engine `onFailure` → `MapView` renders `MapFailure` only; input and slot are gone (FR-13).
6. Error paths: no external calls are added. Cookie write or `replaceState` throwing is not
   expected; if `replaceState` fails the in-memory switch still applies.

## Interfaces

```ts
// src/map/types.ts
export interface MapEngine {
  /** Element inside MapLibre's top-right control stack, after the zoom buttons. */
  readonly controlsSlot: HTMLElement;
  destroy(): void;
}

// src/i18n (client)
export interface LocaleSwitch {
  locale: Locale;
  setLocale(next: Locale): void; // no-op when next === locale
}
export function LocaleProvider(props: {
  initialLocale: Locale;
  children: ReactNode;
}): JSX.Element;
export function useLocaleSwitch(): LocaleSwitch;

// src/i18n (pure)
export function localizedPath(pathWithQueryAndHash: string, locale: Locale): string;
export function localeCookie(locale: Locale): CookieInit; // for cookieStore.set()
export const LOCALE_LABELS: Record<Locale, string>; // { cs: "CZ", en: "EN" }

// src/components/command-input (placeholderConstants.ts, usePlaceholderRotation.ts)
export const PLACEHOLDER_KEYS: readonly [
  "zoomToPrague",
  "showCyclingRoutes",
  "showBrno",
];
export function usePlaceholderRotation(options: {
  count: number;
  paused: boolean;
}): number; // current index
```

Messages (added to both files, typed through the `AppConfig` augmentation):
`input.label`, `input.placeholders.{zoomToPrague,showCyclingRoutes,showBrno}`,
`language.group`, `language.cs`, `language.en`. Texts per FR-4, FR-11, FR-12.

## External services

None added (NFR-1, AC-20). `@base-ui/react` is MIT, no account or key.

## Error handling

- Map cannot load → failure message only; no input, no switch (FR-13, AC-11).
- Unknown locale value reaching `setLocale` → impossible by type; `localizedPath` only replaces
  the first path segment and keeps query and hash.
- Cookie blocked or `cookieStore.set` rejects → ignored; language still switches for this page;
  the next visit falls back to URL / `Accept-Language` as today.
- Engine creation throws (WebGL) → existing failure path; fake slot is never rendered.

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1, FR-2 / AC-1, AC-2 | T-5 (`CommandInput`, no submit handling) |
| FR-3, FR-4 / AC-3 | T-5 (`PLACEHOLDER_KEYS`, messages) |
| FR-5 / AC-4 | T-5 (`paused` while non-empty, native placeholder) |
| FR-6 / AC-5 | T-3 (slot), T-4 (`LanguageSwitch`) |
| FR-7 / AC-6 | T-2 (`LocaleProvider`, D-3), T-4 |
| FR-8, NFR-6 / AC-7 | T-2 (no remount, D-3), T-6 tests |
| FR-9 / AC-8 | T-5 (index kept across locale change) |
| FR-10 / AC-9 | T-2 (no-op), T-4 |
| FR-11, FR-12 / AC-10 | T-4, T-5 (messages, names) |
| FR-13 / AC-11 | T-3, T-5 (rendered only in non-failed branch) |
| FR-14 / AC-12, AC-13 | D-1, D-2; T-1, T-4, T-5 |
| NFR-1 / AC-20 | D-1 (MIT, no service) |
| NFR-2 | D-6, messages parity test |
| NFR-3 / AC-14–16 | D-1, D-5 (native placeholder, no animation); manual |
| FR-15 / AC-21, AC-22 | D-7; T-3 (attribution top-left, width cap); manual |
| NFR-4, NFR-7 / AC-17, AC-18 | D-4, D-5, D-7; T-4 (switch 29 px), T-5 (44 px input); manual |
| NFR-5 / AC-19 | Manual in four browsers |

## Implementation plan

1. **T-1: Install Base UI** – add `@base-ui/react`. Done when: build, lint, typecheck and tests
   pass. Covers: FR-14, NFR-1.
2. **T-2: Client locale state** – `LocaleProvider`, pure helpers, switch the locale layout
   to it (server catalogue loading in `request.ts` stays for the server). First verify that
   `replaceState` to the other locale does not reload or refetch under Next 16.4; if it does,
   stop and report. Done when: a temporary call of `setLocale` changes URL, `lang`, cookie
   and texts without reload. Covers: FR-7, FR-8, FR-10, NFR-6.
3. **T-3: Control slot in the engine** – extend `MapEngine` with `controlsSlot` (custom
   `IControl` after the zoom control); update fakes in existing tests. Done when: the slot is
   in the DOM directly below the zoom buttons at 320 px and 1920 px, with no custom layout
   CSS. Also move the attribution to the top-left (`attributionControl: false` plus explicit
   `AttributionControl`) and cap its width in `globals.css`. Covers: FR-6, FR-13, FR-15.
4. **T-4: Language switch** – messages `language.*`, `LanguageSwitch` (Base UI RadioGroup) in
   `src/components/language-switch/`, portal into the slot, visible focus, selected state,
   contrast, options the size of the zoom buttons (29 px). Done when:
   switching works by mouse and keyboard and the map stays as panned. Covers: FR-6, FR-7,
   FR-10, FR-12, AC-5, 6, 9, 10, 14.
5. **T-5: Command input** – messages `input.*`, `placeholderConstants.ts`, rotation hook,
   `CommandInput` in `src/components/command-input/`, rendered by `MapView`, at the bottom edge
   (safe-area aware). Done when: hints rotate in order in both languages, pause while typing,
   Enter does nothing, no scroll on focus. Covers: FR-1–5, FR-9, FR-11, FR-13.
6. **T-6: Tests and checks** – tests below; run the manual checks; measure the bundle size
   effect of Base UI and note it in the design's Risks. Done when: `npm test`, lint, typecheck
   and build are green.

## Testing

Vitest (jsdom, fake `CreateMapEngine` returning a plain `div` as `controlsSlot`):

- `localizedPath`: `/cs` → `/en`, keeps query and hash, same-locale is identity (AC-6).
- `localeCookie` object; `LocaleProvider.setLocale`: URL via `history`, `document.lang`,
  `cookieStore.set` call (stubbed with `vi.stubGlobal`), no-op for the active locale (AC-6, AC-9).
- Tests sit next to the code: `src/components/{map,language-switch,command-input}/`, `src/i18n/`.
- Rotation hook (fake timers): order and wrap-around, paused while non-empty, resumes (AC-3,
  AC-4); `CommandInput`: Enter changes nothing and keeps the text (AC-2); accessible names in
  both languages (AC-10); placeholder texts per language (AC-3, AC-8).
- `MapView` + `LocaleProvider`: after `setLocale`, the factory was called once and `destroy`
  never; typed text kept; map region name changes (AC-6, AC-7). Failure → no textbox and no
  radiogroup (AC-11).
- `LanguageSwitch`: group and option names per language, selected option marked, keyboard
  selection (AC-10, AC-14).
- Messages parity (existing test) covers the new keys (NFR-2).

Manual (jsdom has no MapLibre or layout): AC-5, 7 with a real pan/zoom, AC-14 (Tab order),
AC-15 (contrast over map), AC-16 (screen reader, reduced motion), AC-17 (320/768/1920 px,
both orientations), AC-18 (touch, focus without scroll; zoom buttons and switch exempt), AC-19 (four browsers),
AC-21, 22 (attribution top-left, collapsed and expanded at 320 px).

## Risks / open questions

- Accepted (user decisions 2, 3): zoom buttons and switch options are ~29 px, below 44 px;
  NFR-7 / AC-18 apply only to the input. They may be harder to tap on small touch screens.
- Cookie Store API needs Firefox 140+ and Safari 18.4+; fine for "latest versions only".
- The top-left corner is now taken by the attribution; revisit with the header spec.
- Native placeholder swaps are instant, so no fade is built; if a transition is wanted later it
  must respect `prefers-reduced-motion`.
- The input promises nothing yet (spec suggestion): a disabled look or "coming soon" note is
  the analyst's decision.
- Back/forward do not undo a language switch (`replaceState`); intentional.
- The top-right corner is shared with a future header; revisit with that spec.
- Base UI Radio docs do not state whether `aria-label` on `Radio.Root` overrides the visible
  "CZ"/"EN" text; the developer verifies the computed accessible names (AC-10).
