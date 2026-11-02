# GeoGrind

A Next.js map application for the Czech Republic controlled by natural language.
Type commands like "Zoom to Prague" or "Show cycling routes" and the map reacts.

## Status

Early development. Current features:

- Full-screen map of the Czech Republic (MapLibre GL JS, OpenFreeMap vector tiles) with pan,
  zoom and zoom buttons
- Localised message when the map cannot be loaded
- Czech (`/cs`) and English (`/en`) versions; `/` redirects by browser language (fallback Czech)

The natural-language input is not implemented yet.

Tech stack: TypeScript (strict), Next.js (App Router), next-intl, MapLibre GL JS, Tailwind CSS, Vitest,
Biome.

## Requirements and setup

- Node.js 26 (see `.nvmrc`)
- No environment variables and no API keys are needed. The map loads its style and tiles from
  the free public [OpenFreeMap](https://openfreemap.org/) service, so an internet connection
  and a WebGL2-capable browser are required.

```bash
npm install
npm run dev        # development server at http://localhost:3000
npm test           # unit tests (Vitest)
npm run lint       # Biome lint and format check
npm run typecheck  # TypeScript check
npm run build      # production build
npm start          # run the production build
```

## Project structure

```
src/app/         routes, layouts, global styles ([locale] segment)
src/components/  React components (map view, failure message)
src/map/         map engine interface, MapLibre implementation, map config
src/config/      app-wide constants
src/i18n/        routing, request config, typed messages
src/proxy.ts     locale redirect (next-intl)
messages/        cs.json, en.json
docs/            specs, designs, architecture
```

## Documentation

- [Architecture](docs/architecture.md)
- [Specs](docs/specs/)
- [Designs](docs/design/)

## AI agents

The project uses Claude Code subagents (`.claude/agents/`) for its workflow:

- **analyst** – turns requests into specs in `docs/specs/`
- **architect** – turns specs into technical designs in `docs/design/` and keeps
  `docs/architecture.md` up to date
- **developer** – implements designs (or small specs) with tests and keeps this README up to
  date
