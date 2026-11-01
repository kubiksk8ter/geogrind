# GeoGrind – Architecture

## Stack

- Language: TypeScript 6.0 (strict) – TS 7 not yet reliable with `next build`.
- Framework: Next.js 16 (App Router) with React 19 – UI, server code, dev and build.
- i18n: next-intl 4 – App Router native, typed messages, locale routing (`/cs`, `/en`, default `cs`).
- Tests: Vitest 5 + jsdom + Testing Library.
- Lint/format: Biome 2 – fast native tooling.
- Runtime: Node 22.12+ (required by Vitest 5).

## Structure

```
src/app/         routes, layouts, global styles ([locale] segment)
src/components/  presentational React components
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
| none yet | – | – | – |

## Key decisions

- Always-prefixed locale URLs (`/cs`, `/en`), `/` redirects by cookie / `Accept-Language`
  (fallback cs); product name "GeoGrind" is a constant, not a message –
  [design 001](design/001-app-skeleton-intro-screen.md)
- TypeScript 6 pinned until Next.js supports TS 7 – [design 001](design/001-app-skeleton-intro-screen.md)
- Server runtime required (no static export) – [design 001](design/001-app-skeleton-intro-screen.md)
