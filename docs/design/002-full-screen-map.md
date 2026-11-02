# 002 – Full-screen map of the Czech Republic (design)

- **Status:** Draft
- **Date:** 2026-11-02
- **Spec:** [002 – Full-screen map](../specs/002-full-screen-map.md)
- **Next agent:** developer

## Summary

The `[locale]` page renders a client-only `MapView` that creates a MapLibre GL JS map in a
viewport-sized container, styled by OpenFreeMap and fitted to the Czech Republic's bounding box.
All MapLibre code sits behind a small `MapEngine` interface so React components and tests never
touch WebGL. The page keeps a visually hidden `<h1>` with `APP_NAME`; the map region is named
from messages. If the style or tiles fail to load, the same full-screen area shows a
localised message instead.

## Decisions

### D-1: Map library – MapLibre GL JS (user-approved)

- **Choice:** `maplibre-gl` 6.16.0 (BSD-3-Clause, bundled types), used directly, no React wrapper.
- **Alternatives considered:** Leaflet (raster-oriented, weak layer/camera animation, no bundled
  types); `react-map-gl` / `@vis.gl/react-maplibre` wrapper (extra layer; the map is imperative
  and sits behind our own interface anyway).
- **Rationale:** Vector rendering, `flyTo`, layer toggling and data layers are exactly what
  command-driven features need. Provider-agnostic: any style URL works.
- **Concerns:** About 29 MB unpacked, ~1 MB minified bundle (5.x figures, v6 not measured) –
  loaded only on the client via dynamic import, so it does not block the server render.
  WebGL2 is mandatory and the package is ESM-only (fine for latest browsers). v6 needs an
  explicit worker setup under bundlers; see Risks.

### D-2: Tile/style provider – OpenFreeMap (user-approved)

- **Choice:** Public OpenFreeMap vector style, "liberty"
  (`https://tiles.openfreemap.org/styles/liberty`), held in one config constant.
- **Alternatives considered:** Mapy.com API (250k tile credits/month, key in browser, no mixing
  of other map data, mandatory logo; free-tier exhaustion can stop the API), MapTiler (account,
  non-commercial free plan, limits unverified), OSM raster tiles (policy discourages app use).
- **Rationale:** No account or key, no stated request caps (NFR-1, AC-11), full vector style,
  attribution added automatically by MapLibre (FR-9).
- **Concerns:** No SLA; terms allow discontinuation. Mitigation: style URL is a single config
  value, so switching to self-hosted tiles or another provider needs no code change.

### D-3: Client-only map, behind an interface

- **Choice:** `MapView` is a client component loaded with `next/dynamic` (`ssr: false`).
  It talks to a `MapEngine` created by a factory; the MapLibre implementation lives in
  `src/map/`. Components get the factory via a prop-free default that tests can override
  (developer decides the injection mechanism).
- **Rationale:** MapLibre needs `window`/WebGL and cannot run in jsdom. A thin interface keeps
  logic testable and is the seam future specs extend (`flyTo`, layers).

### D-4: Full-viewport sizing

- **Choice:** The map container and the failure area use the same full-viewport box: fixed to
  the viewport, `100dvh`/`100dvw`, `body` margin 0, `overflow: hidden`. MapLibre's built-in
  resize observation handles resizes; no custom resize logic.
- **Rationale:** `dvh` tracks mobile address-bar show/hide (FR-4). Fixed positioning avoids
  scrollbars and page content below (FR-3). Visually hidden `<h1>` must not add layout.

### D-5: Initial view via bounds

- **Choice:** `fitBounds` over the Czech Republic bounding box (SW `[12.09, 48.55]`,
  NE `[18.87, 51.06]`, lon/lat) with no padding beyond a minimal inset; no `maxBounds`.
- **Rationale:** Yields the largest zoom showing the whole country, centred (FR-2). Fitting
  also adapts to any viewport shape. Restricting panning is out of scope.

### D-6: Failure detection

- **Choice:** The engine reports `onFailure` when: WebGL2 is unavailable or the map constructor
  throws, the style fails to load (style fetch error), or the first load never completes
  (timeout). Individual tile errors after the style loaded are ignored (spec assumption).
- **Rationale:** Matches "cannot be displayed at all" (FR-11). The timeout covers hung
  requests; its value is the developer's choice (consistent with NFR-5, generous).

### D-7: Visible name and accessibility

- **Choice:** Hidden `<h1>` (visually-hidden CSS class) with `APP_NAME` replaces `IntroScreen`
  (remove the component and its test). The map container has `role="region"` and an accessible
  name from messages (`map.label`). The failure message is rendered with a live-region role
  (alert) and dark-on-light colours (≥ 4.5:1).

## Dependencies

| Package | Version | Purpose | Install / bundle size |
|---|---|---|---|
| maplibre-gl | 6.16.0 | Map rendering, bundled types | ~29 MB unpacked, ~1 MB min (5.x) |

No other packages: no `@types/*` needed, no schema library (the style is fetched and
validated by MapLibre itself; no app-owned external data is parsed).

## Components

| Component | Responsibility | Folder |
|---|---|---|
| Page / layout | Hidden `<h1>`, mounts `MapView`, title metadata (unchanged) | `src/app/[locale]/` |
| MapView | Client component: creates/destroys engine, shows map or failure message | `src/components/` |
| MapFailure | Full-screen localised failure message | `src/components/` |
| MapEngine | Interface + MapLibre implementation + map config (style URL, bounds) | `src/map/` |
| Messages | `map.label`, `map.loadError` in `cs.json` / `en.json` | `messages/` |
| Global styles | Full-viewport box, visually-hidden class, MapLibre CSS import | `src/app/` |

## Data flow

1. `/cs` or `/en` renders on the server: `<h1>`, then the dynamic `MapView` placeholder
   (plain neutral background, same full-viewport box).
2. On the client, `MapView` imports the map module, calls `createMapEngine({ container })`,
   which builds the MapLibre map with the style URL and fits the Czech bounds.
3. MapLibre fetches the style and tiles from OpenFreeMap and renders; attribution and zoom
   controls are MapLibre's built-ins (FR-9, FR-10).
4. Failure path: the engine calls `onFailure` (D-6) → `MapView` destroys the engine and renders
   `MapFailure` in the same box with the message for the active locale.
5. On unmount, `destroy()` removes the map (also needed for React strict-mode double mount).

## Interfaces

```ts
// src/map
export interface MapEngine {
  destroy(): void;
}

export interface MapEngineOptions {
  container: HTMLElement;
  onFailure: (reason: "webgl" | "style" | "timeout") => void;
}

export type CreateMapEngine = (options: MapEngineOptions) => MapEngine;

export const MAP_CONFIG: {
  styleUrl: string; // OpenFreeMap liberty
  czechBounds: readonly [readonly [number, number], readonly [number, number]]; // [[w,s],[e,n]]
};
```

Future specs add methods (e.g. `flyTo`, `setLayerVisible`) to `MapEngine`; none now.

Messages: `map.label` ("Mapa České republiky" / "Map of the Czech Republic") and
`map.loadError` (texts per FR-8, FR-11), typed via the existing `AppConfig` augmentation.

## External services

| Service | Purpose | Free-tier limits | Key / config |
|---|---|---|---|
| OpenFreeMap (`tiles.openfreemap.org`) | Vector style and tiles | No stated caps, no SLA, as-is | No key; style URL in `MAP_CONFIG` (browser) |

## Error handling

- WebGL2 unsupported or constructor throws → `onFailure("webgl")` → failure message (FR-11).
- Style fetch fails / provider blocked or offline → `onFailure("style")` → failure message
  (AC-14).
- No load completion within the timeout → `onFailure("timeout")` → failure message.
- Single tile errors after load → ignored; MapLibre retries on its own.
- Provider rate limiting (HTTP 429) after load → same as tile errors; none expected (D-2).
- Unknown locale → 404 (unchanged from 001).

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1 / AC-1 | T-3 (page renders `MapView`; redirect untouched) |
| FR-2 / AC-2 | T-2 (`fitBounds`, D-5) |
| FR-3, FR-4 / AC-3, AC-4, NFR-4 | T-1 (full-viewport CSS), T-3 |
| FR-5 / AC-5 | T-2 (MapLibre default interactions) |
| FR-6, FR-7 / AC-6, AC-7, NFR-3 | T-3 (hidden `<h1>`, metadata) |
| FR-8 / AC-8, NFR-2 | T-3 (`map.label`) |
| FR-9, FR-10 / AC-9, AC-10 | T-2 (built-in attribution/controls only) |
| FR-11 / AC-14–16 | T-2 (failure detection), T-4 (`MapFailure`) |
| NFR-1 / AC-11 | D-2 |
| NFR-5 / AC-12 | T-3 (dynamic import), manual |
| NFR-6 / AC-13 | Manual in four browsers |

## Implementation plan

1. **T-1: Install and full-viewport base** – add `maplibre-gl`, replace global CSS with the
   full-viewport box and visually-hidden class. Done when: build/lint/typecheck pass and a
   plain box fills the viewport without scrollbars. Covers: FR-3, FR-4.
2. **T-2: Map engine** – `src/map/` with `MapEngine`, MapLibre implementation (style, bounds,
   worker setup, failure detection, destroy) and `MAP_CONFIG`. Done when: engine shows the
   Czech Republic in a test page and failures call `onFailure`. Covers: FR-2, FR-5, FR-9–11.
3. **T-3: Page integration** – hidden `<h1>`, dynamic `MapView`, `map.label` messages in both
   languages, remove `IntroScreen`. Done when: `/cs`, `/en`, `/` show the map with one hidden
   `<h1>`, named region and "GeoGrind" title. Covers: FR-1, 6–8.
4. **T-4: Failure state** – `MapFailure`, `map.loadError` messages, wiring in `MapView`.
   Done when: blocking the provider shows the localised message full-screen. Covers: FR-11.
5. **T-5: Tests and docs** – tests below; update README. Done when: `npm test` green.

## Testing

Vitest (jsdom, fake `CreateMapEngine`):

- `MapView` calls the factory once with a container, calls `destroy` on unmount, and renders
  `MapFailure` with the right locale text when `onFailure` fires (AC-14, AC-16 role).
- Page renders exactly one `h1` with `APP_NAME`; map region has the `map.label` name per
  locale (AC-6, AC-8); no `IntroScreen` leftovers.
- `MAP_CONFIG`: bounds are valid (west < east, south < north) and cover the country.
- Message parity test (existing) covers the new keys.
- Engine failure mapping is tested by injecting a throwing/failing MapLibre constructor where
  practical; MapLibre itself is not rendered in jsdom.

Manual: AC-2–5, 9, 10, 12, 13, 15 (resize, rotate, zoom, mobile address bar, 320/768/1920 px,
four browsers), AC-14 (block `tiles.openfreemap.org` in devtools), AC-16 contrast check.

## Risks / open questions

- MapLibre v6 worker loading under Next's bundler (Turbopack/webpack) may need
  `setWorkerUrl` with a `new URL(..., import.meta.url)` asset; verify in T-2 and report if the
  documented Vite recipe does not translate.
- OpenFreeMap has no SLA; revisit self-hosting or Mapy.com if reliability becomes an issue.
- Bundle size of v6 is unmeasured; check NFR-5 (AC-12) after T-3.
- Spec 001 tests/design for `IntroScreen` are superseded and removed in T-3.
