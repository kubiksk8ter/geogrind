# GeoGrind – Architecture

## Stack

- Language: TypeScript 6.0 (strict) – TS 7 not yet reliable with `next build`.
- Framework: Next.js 16 (App Router) with React 19 – UI, server code, dev and build.
- i18n: next-intl 4 – App Router native, typed messages, locale routing (`/cs`, `/en`, default `cs`).
- Tests: Vitest 5 + jsdom + Testing Library.
- Lint/format: Biome 2 – fast native tooling.
- Styling: Tailwind CSS 4 (via `@tailwindcss/postcss`) – utility classes in components;
  `globals.css` imports Tailwind and MapLibre CSS and caps the width of the expanded attribution.
- UI components: Base UI (`@base-ui/react`) – unstyled, accessible, tree-shakable, MIT; used for
  all interactive controls (input, language switch, future side panel tabs/switches/meter).
- Runtime: Node 26 (`.nvmrc`; Vitest 5 needs 22.12+).
- Map: MapLibre GL JS 6 – vector rendering, camera/layer API; client-only, behind `MapEngine`.
- Map tiles/style: OpenFreeMap (liberty) – free, no key, no stated caps.

## Structure

```
src/app/         routes, layouts, global styles ([locale] segment)
src/components/  React components, one folder per feature (map, language-switch, command-input) with their hooks and tests
src/map/         MapEngine interface, MapLibre implementation, map config
src/tiles/       (PLANNED, not implemented – map layers on hold) server-only tile proxy logic: validation, upstream fetch, TileStore (disk cache), rate limiter
src/config/      app-wide constants (e.g. APP_NAME)
src/i18n/        routing, request config, typed messages, client LocaleProvider, helpers
src/proxy.ts     next-intl locale interceptor (Next 16 "proxy")
messages/        cs.json, en.json
docs/            specs/, design/, architecture.md
```

Conventions: logic lives outside React components where practical; external services go
behind interfaces that tests can replace; secrets stay in server-side code.

## External services

| Service | Purpose | Free-tier limits | Key / config |
|---|---|---|---|
| OpenFreeMap | Vector map style and tiles | No stated caps, no SLA | No key; style URL in `src/map` config (browser) |
| OpenTopoMap (PLANNED, not implemented) | Outdoor raster base map (CC-BY-SA) | Fair use, no SLA, small server | No key; fetched by the tile proxy (server) |
| Waymarked Trails (PLANNED, not implemented) | Hiking and cycling raster overlays | Moderate access rates, caching, referrer | No key; fetched by the tile proxy (server) |

> **Status: map layers are on hold.** Spec 005 and design 005 are kept for reference, but
> nothing below marked PLANNED exists in the code. The main reason for postponing is the
> licence and usage terms of the tile services (see below).

Waymarked Trails may be used only by open-source, non-commercial apps (no ads, no affiliate
income) with moderate access rates. The repository is public but has no licence yet; adding
one (MIT was proposed) would be a prerequisite for using Waymarked Trails.

Tile proxy env (PLANNED, server only): `TILE_CACHE_DIR`, `TILE_CACHE_MAX_MB`, `TILE_CONTACT_URL`,
`SITE_URL`, `TILE_RATE_LIMIT_PER_MINUTE`, `TILE_RATE_LIMIT_PER_HOUR`, `TILE_CLIENT_IP_HEADER`,
`TILE_TRUSTED_PROXY_HOPS`.

## Key decisions

- Always-prefixed locale URLs (`/cs`, `/en`), `/` redirects by cookie / `Accept-Language`
  (fallback cs); product name "GeoGrind" is a constant, not a message –
  [design 001](design/001-app-skeleton-intro-screen.md)
- TypeScript 6 pinned until Next.js supports TS 7 – [design 001](design/001-app-skeleton-intro-screen.md)
- Server runtime required (no static export) – [design 001](design/001-app-skeleton-intro-screen.md)
- MapLibre GL JS + OpenFreeMap (both user-approved); provider is one style-URL config value, so
  it can be swapped (e.g. Mapy.com, self-hosted tiles) – [design 002](design/002-full-screen-map.md)
- Map code is client-only and hidden behind `MapEngine`; future map features extend that
  interface – [design 002](design/002-full-screen-map.md)
- Intro screen replaced by the map; "GeoGrind" `<h1>` is visually hidden –
  [design 002](design/002-full-screen-map.md)
- Base UI chosen as the UI component library; no chart library until the side panel spec –
  [design 003](design/003-user-input-and-language-switch.md)
- Locale is client state; language switch uses `history.replaceState` (no navigation, so the
  map is never reloaded) and a client `LocaleProvider` with both catalogues –
  [design 003](design/003-user-input-and-language-switch.md)
- Language switch is portaled into a MapLibre control slot exposed by `MapEngine`
  (`controlsSlot`), stacked below the zoom buttons with options of the same size (29 px);
  command input is a React overlay in `MapView` at the bottom edge (safe-area aware) –
  [design 003](design/003-user-input-and-language-switch.md)
- Map attribution is an explicit `AttributionControl` at top-left (built-in disabled), width
  capped in `globals.css` – [design 003](design/003-user-input-and-language-switch.md)
- `NEXT_LOCALE` cookie is written with the Cookie Store API (`localeCookie` returns a
  `CookieInit`), because Biome forbids `document.cookie` –
  [design 003](design/003-user-input-and-language-switch.md)
- Motion is plain CSS transitions (Tailwind classes, `motion-reduce:transition-none` via the
  shared `TRANSITION_CLASS_NAME`), no animation library; applied to the input focus border and
  the language switch selection only –
  [design 004](design/004-motion-transitions.md)
- PLANNED, not implemented (layers on hold; the next four decisions describe design 005 only):
  Layers: `LayerState` lives in `MapView`, applied via `MapEngine.setLayers`; base map switch is
  a `setStyle` swap (inactive sources never request), overlays are raster sources added on
  demand, attribution is rebuilt from the active layers (non-compact when a share-alike layer
  is active); layer control is portaled into a second top-left control slot below the
  attribution – [design 005](design/005-map-layers.md)
- Raster layers (OpenTopoMap, Waymarked Trails) go through a caching tile proxy
  (`/api/tiles/{layer}/{z}/{x}/{y}`, `src/tiles/`): on-demand only, allow-listed hosts, z/x/y
  and Czech-bbox validation, disk cache behind a `TileStore` interface (env-configurable
  directory, TTL, size limit); OpenFreeMap stays direct; map and raster sources are limited
  to the Czech Republic (`maxBounds`, source `bounds`) – [design 005](design/005-map-layers.md)
- Tile proxy has a per-IP rate limit behind a `RateLimiter` interface (in-memory default,
  429 + `Retry-After`, client IP from one configured trusted header); off outside production;
  mandatory before public hosting, not for local development – [design 005](design/005-map-layers.md)
- Proposed MIT licence (not added): would satisfy Waymarked Trails' open-source condition,
  together with "non-commercial: no ads, no affiliate income" –
  [design 005](design/005-map-layers.md)
- Tailwind CSS added at the user's request (supersedes "no Tailwind" in design 001); shared
  class sets live in `src/components/sharedConstants.ts`
