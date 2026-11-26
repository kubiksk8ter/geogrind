# 001 – Application skeleton with intro screen (design)

- **Status:** Draft
- **Date:** 2026-11-01
- **Spec:** [001 – Application skeleton with intro screen](../specs/001-app-skeleton-intro-screen.md)
- **Next agent:** developer

## Summary

A Next.js App Router project (TypeScript strict) with `next-intl` locale routing using
always-prefixed URLs: Czech at `/cs`, English at `/en`; `/` redirects to a locale. A single page
renders an `IntroScreen` component with
an `<h1>` containing the product name. The name is a code constant (never translated); message
files for `cs` and `en` exist and are wired up but empty, since the skeleton has no other text.
Vitest, Biome and a message-parity test are set up so later features have a working base.

## Decisions

### D-1: i18n library – next-intl

- **Choice:** `next-intl` with `localePrefix: "always"`, default locale `cs`, locales
  `cs` and `en`, a `[locale]` route segment, and `<html lang={locale}>` in the root layout.
- **Alternatives considered:** `react-i18next` (more setup with the App Router, weaker server
  component story), Next's built-in i18n (removed from App Router).
- **Rationale:** Built for App Router and server components, bundled types, typed messages via
  a global `AppConfig` declaration, ~410 KB unpacked, MIT, supports Next 16.
- **Concerns:** none.

### D-2: Locale detection and routing

- **Choice:** next-intl's request interceptor in `src/proxy.ts` (Next 16 name for middleware).
  Locale precedence is the library default: URL prefix, then cookie, then `Accept-Language`,
  then `cs`. The cookie is what a future language switcher will set. URLs are always
  prefixed (`/cs`, `/en`); `/` redirects to the detected locale.
- **Alternatives considered:** `as-needed` (Czech unprefixed at `/`) – inconsistent URLs for
  the two languages.
- **Rationale:** Consistent URLs for both languages; each language has its own stable address.
  Czech remains the fallback (spec assumption). The redirect needs a server runtime, so no
  `output: "export"`; later Route Handlers (LLM proxy) need a server anyway.

### D-3: Product name is not a message

- **Choice:** Export `APP_NAME = "GeoGrind"` from `src/config/`. The `<h1>` and the page title
  both use it; neither goes through the message catalogue.
- **Rationale:** FR-3 / AC-3: identical in both languages by construction, no chance of drift.

### D-4: TypeScript 6, not 7

- **Choice:** `typescript@6.0.3`.
- **Alternatives considered:** TypeScript 7.0.2 (native compiler, current `latest`).
- **Rationale:** Sources conflict on whether `next build` type-checking works with TS 7 (it
  removed the JS compiler API Next calls; some projects report failures even on Next 16.3).
  Revisit once the Next.js release notes confirm support.

### D-5: Tooling – Biome, no Tailwind

- **Choice:** Biome (Rust) for lint and format; plain global CSS (one small file). Next 16 has
  no `next lint`, so a `lint` script runs `biome check`.
- **Rationale:** Fast, small, one tool; the skeleton needs a few CSS rules only. Contrast: use
  dark text on a light background (≥ 4.5:1, ideally ≥ 7:1).

### D-6: Test setup

- **Choice:** Vitest with `jsdom` and `@testing-library/react`; `@vitejs/plugin-react` is needed
  because Next's tsconfig uses `jsx: "preserve"`. Keep UI logic in plain components
  (`IntroScreen`) so tests do not need to render async server components.
- **Concerns:** Vitest 5 requires Node `^22.12 || ^24 || >=26`; Next requires `>=20.9`. Pin
  Node 22.12+ via `engines` in `package.json` and `.nvmrc`.

### D-7: Hosting (informational)

- **Choice:** No hosting is required by the spec. The app runs with `next build && next start`.
  Vercel Hobby is the natural free option (non-commercial use); decide when deploying.

## Dependencies

| Package | Version | Purpose | Install / bundle size |
|---|---|---|---|
| next | 16.4.3 | Framework | ~192 MB unpacked (incl. SWC binaries) |
| react | 19.3.1 | UI | small |
| react-dom | 19.3.1 | UI | small |
| next-intl | 4.14.9 | i18n, locale routing | ~410 KB unpacked |
| typescript (dev) | 6.0.3 | Language, bundles types | ~24 MB |
| @types/react (dev) | 19.3.0 | React types | types only |
| @types/react-dom (dev) | 19.3.0 | React DOM types | types only |
| @types/node (dev) | 26.6.6 | Node types | types only |
| vitest (dev) | 5.0.5 | Test runner, bundles types | ~2.8 MB |
| vite (dev) | 8.3.5 | Peer of vitest and plugin-react | n/a |
| @vitejs/plugin-react (dev) | 6.1.2 | JSX transform in tests | small |
| jsdom (dev) | 30.1.3 | DOM for tests | ~5.5 MB |
| @testing-library/react (dev) | 16.3.3 | Component tests | small |
| @testing-library/dom (dev) | 10.4.2 | Peer of the above, bundles types | small |
| @biomejs/biome (dev) | 2.6.4 | Lint + format | native binary |

Verify peer ranges and the Node engine on install; if `npm` reports a conflict, report it
rather than forcing.

## Components

| Component | Responsibility | Folder |
|---|---|---|
| Routes / layout | `[locale]` layout (`<html lang>`, next-intl provider, title metadata), page | `src/app/` |
| IntroScreen | Renders the `<h1>` with the product name, centred | `src/components/` |
| i18n config | Routing definition, request config, typed-messages declaration | `src/i18n/` |
| Messages | `cs.json`, `en.json` | `messages/` |
| App config | `APP_NAME` | `src/config/` |
| Proxy | next-intl locale interceptor (`src/proxy.ts`) | `src/` |
| Global styles | Centring, readable at 320 px, contrast | `src/app/` |

## Data flow

1. Request to `/` hits `proxy.ts`; next-intl resolves the locale (cookie, `Accept-Language`,
   fallback cs) and redirects to `/cs` or `/en`. Requests to `/cs` or `/en` pass through.
2. `[locale]/layout.tsx` validates the locale (unknown → `notFound()`), sets
   `<html lang={locale}>`, wraps children in the next-intl provider.
3. `[locale]/page.tsx` renders `IntroScreen`; `generateMetadata` returns the title from `APP_NAME`.
4. Error path: an unsupported locale segment (e.g. `/de`) → Next 404 page. No external calls
   exist, so there are no timeouts or rate limits to handle.

## Interfaces

```ts
// src/config
export const APP_NAME = "GeoGrind" as const;

// src/i18n/routing.ts
export const routing: {
  locales: readonly ["cs", "en"];
  defaultLocale: "cs";
  localePrefix: "always";
};
export type Locale = (typeof routing.locales)[number];

// src/components
export function IntroScreen(): React.JSX.Element; // <h1>{APP_NAME}</h1> only
```

Messages are typed through next-intl's `AppConfig` augmentation (`Locale`, `Messages` from
`messages/cs.json`) so a missing key is a compile error once messages are added.

## External services

None. (NFR-1, AC-9: all dependencies are open source; no accounts or keys.)

## Error handling

- Unknown locale in URL (e.g. `/de`) → 404.
- `/` with no or unsupported language preference → redirect to `/cs` (AC-1).
- Missing message key (future) → compile error via typed messages plus the parity test.
- Skeleton has no network calls, so no timeout/rate-limit handling is needed.

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1 / AC-1 | T-1, T-3 |
| FR-2 / AC-2, NFR-3 | T-3 (`IntroScreen`, `<h1>`) |
| FR-3 / AC-3 | T-2, T-3 (`APP_NAME` constant, `/cs` and `/en`) |
| FR-4 / AC-4 | T-3 (`generateMetadata`) |
| FR-5 / AC-5 | T-3 (page contains only the heading) |
| NFR-2 / AC-6 | T-2 (`<html lang>`, message files) |
| NFR-4 / AC-7 | T-3 (CSS) |
| NFR-3 / AC-8 | T-3 (CSS colours) |
| NFR-1 / AC-9 | T-1 (dependency choice) |
| NFR-5 | T-1 (no polyfills; browserslist not customised) |

## Implementation plan

1. **T-1: Project scaffold** – package.json (scripts: `dev`, `build`, `start`, `lint`, `test`,
   `typecheck`), strict `tsconfig`, `next.config`, Biome config, Vitest config, `.gitignore`,
   `.nvmrc`, `engines`. Install dependencies from the table. Done when: `npm run build`,
   `lint`, `typecheck`, `test` (with a trivial test) pass. Covers: NFR-1, NFR-5.
2. **T-2: i18n wiring** – routing, request config, proxy, root layout with `<html lang>`,
   empty `cs.json`/`en.json`, typed-messages declaration. Done when: `/` redirects to `/cs`
   (or `/en` per cookie / `Accept-Language`), `/cs` renders with `lang="cs"`, `/en` with
   `lang="en"`, `/de` is 404. Covers: NFR-2, AC-6.
3. **T-3: Intro screen** – `APP_NAME`, `IntroScreen`, page, title metadata, global CSS.
   Done when: `/cs` and `/en` (and `/` after its redirect) show "GeoGrind" as the only `<h1>` and title, no other
   interactive element, fine at 320 px. Covers: FR-1–5, AC-1–5, 7, 8.
4. **T-4: Tests and README** – tests below; update README status and add run commands.
   Done when: `npm test` green. Covers: AC-2, 3, 5, 6.

## Testing

Vitest:

- `IntroScreen` renders exactly one heading level 1 with the text "GeoGrind" and no
  buttons, links, inputs (AC-2, AC-3, AC-5).
- Routing config: locales are `cs` and `en`, default `cs`, `localePrefix` is `always` (AC-6).
- Message parity: `cs.json` and `en.json` have identical key sets (NFR-2).
- Metadata function returns a title containing `APP_NAME` (AC-4).

Manual: AC-1 (open `/` with Czech and English `Accept-Language`, confirm redirect to `/cs` /
`/en` and the intro screen; also open `/cs` and `/en` directly), AC-6 (inspect `<html lang>`), AC-7
(320 px viewport), AC-8 (browser devtools contrast check), AC-9 (review dependencies), NFR-5
(latest Chrome, Firefox, Safari, Edge).

## Risks / open questions

- TypeScript 7 may become viable soon (D-4); revisit later.
- Empty message files are a placeholder; the first spec with real text fills them.
- The spec has no language switcher, so a language is chosen only via the URL or browser
  language until a follow-up spec adds it.
