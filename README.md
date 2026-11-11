# GeoGrind

A Next.js map application controlled by natural language.
Type a zoom command like "Zoom to Prague" or "Přibliž na Brno" and the map moves there.

## Status

Early development. Current features:

- Full-screen world map that opens on the Czech Republic (MapLibre GL JS, OpenFreeMap vector tiles) with pan,
  zoom and zoom buttons; the collapsible attribution sits in the top-left corner
- Localised message when the map cannot be loaded
- Czech (`/cs`) and English (`/en`) versions; `/` redirects by browser language (fallback Czech)
- CZ/EN language switch below the zoom buttons (same button size); switching changes all texts and the address
  without reloading the map
- Command input at the bottom edge of the map with rotating example hints. Zoom commands work:
  Czech or English text is interpreted by AI (Groq) and the place is looked up with a geocoder
  (Nominatim), anywhere in the world. Towns, regions and natural features can be searched, and so can
  landmarks such as the Eiffel Tower or the Colosseum ("Přibliž na Koloseum"); a landmark wins over a
  hotel of a similar name unless the command asks for a hotel. Other commands get a "not supported" message.
- Highlight of the found object after a zoom: landmarks, hotels and other POIs, natural features, rivers
  and streets are drawn on the map (a point or an outline); towns,
  regions, countries and protected areas are not. The highlight disappears as soon as the next command is sent, and fades out on its own 30 s after the map has reached it.
- Server-side protection of the free services: input validation, a 10 s pause after each processed
  command (also an unsuccessful one), 10 commands per minute per IP address and a daily cap on AI calls; messages are shown in
  the current language and switch with it
- Short colour transitions on the input focus border and the CZ/EN selection;
  disabled with the system "reduced motion" setting

Tech stack: TypeScript (strict), Next.js (App Router, with a Route Handler as the server part),
next-intl, MapLibre GL JS, Tailwind CSS, Base UI, Valibot, Groq (AI), Nominatim (geocoding),
Vitest, Biome.

## Requirements and setup

- Node.js 26 (see `.nvmrc`)
- A free [Groq](https://console.groq.com/keys) API key (no payment method needed) for the zoom
  commands. The map itself loads its style and tiles from the free public
  [OpenFreeMap](https://openfreemap.org/) service, so an internet connection and a
  WebGL2-capable browser are required.

Configuration is read from environment variables on the server. Copy `.env.example` to
`.env.local` (git-ignored) and fill it in; never commit real values.

- `GROQ_API_KEY` – Groq API key, required. Stays on the server.
- `GROQ_MODEL` – optional Groq model, default `openai/gpt-oss-20b`.
- `GEOCODER_URL` – optional Nominatim-compatible geocoder, default the public OSM instance.
- `GEOCODER_CONTACT` – e-mail or URL for the geocoder User-Agent; required in production.
- `CLIENT_IP_HEADER` – header with the real client IP that your reverse proxy always overwrites
  (e.g. `x-real-ip`); required in production, see below.
- `APP_ORIGIN` – allowed `Origin` values, comma separated; default `http://localhost:3000`,
  required in production.
- `STATE_DIR` – optional folder for the limits state, default `.data/` (git-ignored).
- `DAILY_CAP` – optional daily cap of AI calls for all users, default 500.

`GROQ_API_KEY` is required everywhere, in development and in production, and is read only on
the server. For local development it is the only variable you have to set; `GEOCODER_CONTACT`,
`CLIENT_IP_HEADER` and `APP_ORIGIN` are additionally required in production.

In production the app must run as one instance with a writable disk (the limits are kept in a
file in `STATE_DIR`) behind a reverse proxy that sets `CLIENT_IP_HEADER`; without that the
per-IP limits cannot be trusted.

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
src/app/api/     Route Handler of the command endpoint (wiring only)
src/components/  React components, one folder per feature (map, language-switch, command-input)
src/map/         map engine interface, MapLibre implementation (incl. highlight layers), map config
src/server/      server-only code: command pipeline, AI client, geocoder, limits state, env config
src/shared/      contracts shared by browser and server (action list, schemas, text rules)
src/config/      app-wide constants
src/i18n/        routing, request config, typed messages, client locale provider
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

## License

Released under the [MIT License](LICENSE).
