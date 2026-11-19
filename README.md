# GeoGrind

A Next.js map application controlled by natural language.
Type a zoom command like "Zoom to Prague" or "Přibliž na Brno" and the map moves there.

## Status

Early development. Current features:

- Full-screen world map that opens on the Czech Republic (MapLibre GL JS, OpenFreeMap vector tiles) with pan,
  zoom and zoom buttons; the collapsible attribution sits in the top-left corner
- The application is localised into two languages, Czech and English:
  - Czech (`/cs`) and English (`/en`) versions; `/` redirects by browser language (fallback Czech)
  - CZ/EN language switch below the zoom buttons (same button size); switching changes all texts and the
    address without reloading the map
  - Localised message when the map cannot be loaded
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
  the current language and switch with it. IP addresses are never stored in readable form (see
  [What the server stores](#what-the-server-stores)).
- Side panel (control below the language switch) with two tabs, "History" and "Metrics". Full screen on
  phones (closes after picking a history entry), beside a narrowed map from 768 px width.
  - **History:** your successful commands (up to 50 entries). Clicking an entry moves the map there again and
    shows the highlight without any request to the AI or the geocoder. The history stays in session storage
    of the browser tab, so it survives a reload and ends with the tab; it is never sent to the server.
  - **Metrics:** two groups of figures, refreshed every 10 s while the tab is visible and shared by all
    visitors; only numbers are stored, never command text, place names or IP addresses. They are served by
    a read-only, same-origin `GET /api/metrics` and come from normal commands (no extra calls to Groq or
    Nominatim).
    - _AI:_ how much of the free Groq quota the app uses: the app's own daily cap of AI calls with the time
      to the next UTC day, the tokens of the last AI request (input, output, total), the remaining requests
      (per day) and tokens (per minute) with live countdowns to their renewal, the day's token total (UTC
      day, all users) and the model in use.
    - _Application:_ a pie chart of today's command results (successful, unsupported, not found, too early,
      too many commands, AI resting, error) with a legend of counts and percentages; median and 95th
      percentile processing time of the last hour with a sparkline; the load (commands in the last minute
      and hour, active clients, commands in progress); and a status light for the map (from this browser's
      tile loading) and for Nominatim (from the server's last geocoder call). Charts are hand-drawn SVG
      with text equivalents (the pie also has a legend with names and counts).
    - After a server restart the last AI request, the limits, the hour window and the Nominatim status are
      unknown until the next command (hour figures say "since start" during the first hour); the day's
      token total, cap counter and command results are kept in the state file.
- Short colour transitions on the input focus border and the CZ/EN selection;
  disabled with the system "reduced motion" setting

Tech stack: TypeScript (strict), Next.js (App Router, with a Route Handler as the server part),
next-intl, MapLibre GL JS, Tailwind CSS, Base UI, Zustand, Valibot, Groq (AI), Nominatim (geocoding),
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
- `STATE_DIR` – optional folder for the limits and daily metrics state, default `.data/` (git-ignored).
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

## What the server stores

The state file (`STATE_DIR/state.json`) holds the day's counters (AI calls, tokens, command
results), a possible AI pause and one short-lived record per client for the limits.

- A client is identified by its IPv4 address or the /64 prefix of its IPv6 address, which is
  turned into a keyed hash (HMAC-SHA-256, `keyId~digest`) right after the request arrives. Only
  this pseudonym reaches the limits, the state file and the metrics; the raw address is never
  stored or logged.
- The hash key is random, lives only in the server's memory (never on disk) and is destroyed at
  the next UTC midnight, so at most 24 h; a restart also starts with a new key. Every write of the
  state drops client records of other keys and plain IP addresses left by older versions.
- A client record disappears at the latest 60 s after its last command (rate limit and cooldown
  window). At midnight a timer destroys the key and clears all client records even without
  traffic, and the server start (`src/instrumentation.ts`) clears records left by the previous run.
- At the key change, rate limit and cooldown start empty for everyone; the daily cap is not
  affected. The metrics may count a client twice in "active clients" for up to an hour after it.
- While the key exists, the hash is pseudonymised (not anonymous) data. The hosting provider and a
  reverse proxy may still see and log IP addresses; that is outside the app.

## Project structure

```
src/app/         routes, layouts, global styles ([locale] segment)
src/app/api/     Route Handlers of the command and metrics endpoints (wiring only)
src/components/  React components, one folder per feature (map, language-switch, command-input,
                 history = store, storage and History tab, metrics = Metrics tab, side-panel = tabbed panel)
src/map/         map engine interface, MapLibre implementation (incl. highlight layers, tile availability), map config
src/server/      server-only code: command pipeline, AI client, geocoder, limits state, metrics, env config,
                 privacy (client-id hashing key, state purge, key-expiry cleanup)
src/instrumentation.ts  server start hook: clears client records left by the previous run
src/shared/      contracts shared by browser and server (action list, schemas, text rules, metrics contract)
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
