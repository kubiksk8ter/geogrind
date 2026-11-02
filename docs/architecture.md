# GeoGrind – Architecture

## Stack

- Language: TypeScript 6.0 (strict) – TS 7 not yet reliable with `next build`.
- Framework: Next.js 16 (App Router) with React 19 – UI, server code, dev and build.
- i18n: next-intl 4 – App Router native, typed messages, locale routing (`/cs`, `/en`, default `cs`).
- Tests: Vitest 5 + jsdom + Testing Library.
- Lint/format: Biome 2 – fast native tooling.
- Styling: Tailwind CSS 4 (via `@tailwindcss/postcss`) – utility classes in components;
  `globals.css` only imports Tailwind and MapLibre CSS.
- Runtime: Node 26 (`.nvmrc`; Vitest 5 needs 22.12+).
- Map: MapLibre GL JS 6 – vector rendering, camera/layer API; client-only, behind `MapEngine`.
- Map tiles/style: OpenFreeMap (liberty) – free, no key, no stated caps.

## Structure

```
src/app/         routes, layouts, global styles ([locale] segment)
src/components/  React components (MapView, MapFailure)
src/map/         MapEngine interface, MapLibre implementation, map config
src/config/      app-wide constants (e.g. APP_NAME)
src/i18n/        routing, request config, typed-messages declaration
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
- Tailwind CSS added at the user's request (supersedes "no Tailwind" in design 001); shared
  class sets live in `src/components/styles.ts`
