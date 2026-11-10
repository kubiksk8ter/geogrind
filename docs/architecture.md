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
- Validation: Valibot 1 – tiny, tree-shakable, used at every boundary (client and server).
- AI: Groq `openai/gpt-oss-20b` via plain `fetch` from a Route Handler – strict JSON schema
  output on the free tier; key only on the server.
- Geocoding: Nominatim (OSM public instance) via `fetch`, worldwide (no country restriction).
- Server state: one JSON file on local disk behind a `StateStore` interface (single instance).
- `server-only` marks server modules so they cannot reach the browser bundle.

## Structure

```
src/app/         routes, layouts, global styles ([locale] segment)
src/components/  React components, one folder per feature (map, language-switch, command-input) with their hooks and tests
src/map/         MapEngine interface, MapLibre implementation, map config
src/app/api/     Route Handler for the command endpoint (wiring only)
src/server/      server-only code: command pipeline, ai, geocoding, state, config
src/shared/      contracts shared by browser and server (action registry, schemas, text rules)
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
| Groq (`openai/gpt-oss-20b`) | Text -> action + place name | 30 RPM, 1K RPD, 8K TPM, 200K TPD (docs, per organisation); no card | `GROQ_API_KEY`, `GROQ_MODEL` (server) |
| Nominatim (OSM) | Place name -> bounds in CZ | 1 req/s for the app, identifying User-Agent, OSM attribution | `GEOCODER_URL`, `GEOCODER_CONTACT` (server) |

Other server env: `CLIENT_IP_HEADER`, `APP_ORIGIN`, `STATE_DIR`, `DAILY_CAP` (see `.env.example`).

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
- AI zoom command: `POST /api/command` pipeline (guard, IP, limits, Groq, Nominatim); closed
  action registry in `src/shared/command/actions.ts`; server returns result codes, never texts –
  [design 005](design/005-ai-implementation.md)
- Client IP only from an operator-named trusted header (`CLIENT_IP_HEADER`), because Next fills
  `x-forwarded-for` only when absent (forgeable); needs a reverse proxy –
  [design 005](design/005-ai-implementation.md)
- Cooldown, rate limit and daily cap in a lock-protected, atomically written JSON file
  (`.data/`, git-ignored); corrupt state fails safe; hosting needs a persistent disk –
  [design 005](design/005-ai-implementation.md)
- Map moves by `MapEngine.moveTo` (`fitBounds`; reduced motion = jump); server sends bounds –
  [design 005](design/005-ai-implementation.md)
- Tailwind CSS added at the user's request (supersedes "no Tailwind" in design 001); shared
  class sets live in `src/components/sharedConstants.ts`
