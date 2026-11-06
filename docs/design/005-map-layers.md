# 005 – Map layers (base maps and trail overlays) (design)

- **Status:** Draft
- **Date:** 2026-11-06
- **Spec:** [005 – Map layers](../specs/005-map-layers.md)
- **Next agent:** developer

## Summary

Layer selection is React state (`LayerState`) owned by `MapView` and pushed into the engine with
one declarative call, `MapEngine.setLayers(state)`. The engine switches the base map by replacing
the MapLibre style (OpenFreeMap style URL <-> a small inline raster style for OpenTopoMap) and
adds/removes one raster source+layer per active Waymarked Trails overlay, so inactive sources
never make requests. The attribution is rebuilt from the active layers. The tile control is a
Base UI `RadioGroup` (base maps) plus `Toggle` buttons (overlays), portaled into a second
MapLibre control slot below the top-left attribution, so they cannot overlap.

Revision (user-approved, relayed by the coordinator): (1) map and raster layers are limited to
the Czech Republic (D-7); (2) OpenTopoMap and Waymarked Trails tiles go through a caching proxy
(Route Handler) that fetches upstream only when a browser asks and keeps tiles on disk (D-8);
OpenFreeMap stays direct (D-9); (3) the proxy gets a per-IP rate limit, mandatory before public
hosting (D-10, T-9); (4) the app is MIT-licensed open source, which Waymarked Trails' terms
require (D-1, D-11, T-10).

## Decisions

### D-1: Source terms and cost (NFR-1, AC-18) – verified 2026-11-06

| Source | Terms found | Free for this app | Required credit |
|---|---|---|---|
| OpenFreeMap | ToS: "completely free service provided as-is", no caps for map viewing, may be discontinued without notice; no attribution clause | Yes | Style's own: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" |
| OpenTopoMap | CC-BY-SA 3.0; embedding and commercial use allowed "as long as the server is not overloaded"; no uptime guarantee; small vServer since 2026-01-05 (backup server exists) | Yes (fair use) | "Map data: © OpenStreetMap contributors, SRTM \| Map style: © OpenTopoMap (CC-BY-SA)" |
| Waymarked Trails (hiking, cycling) | Help > Legal and Usage Terms (full text supplied by the user): overlay CC BY-SA 3.0 DE, data ODbL. Use on other sites **only if (a) the site/app source code is open source, (b) the app is non-commercial: no ads, no affiliate income, (c) access rates are moderate.** "Please cache tiles as often as possible and use a correct referrer. Mass download of tiles is strongly discouraged." Credit the OpenStreetMap project and this website | Yes, **conditional** on (a)-(c) | "© waymarkedtrails.org" + "© OpenStreetMap contributors" (spec NFR-7; covers both credits) |

- **Choice:** Use all three, no keys, no accounts. Tile URLs: `https://{a|b|c}.tile.opentopomap.org/
  {z}/{x}/{y}.png`, `https://tile.waymarkedtrails.org/{hiking|cycling}/{z}/{x}/{y}.png`.
- **How the Waymarked Trails conditions are met:** (a) public repository
  `kubiksk8ter/geogrind` under the MIT licence (D-11, T-10); (b) the app has no ads, affiliate
  links or paid features (constraint, see Risks); (c) on-demand cache, `maxzoom` 17, per-IP
  rate limit (D-8, D-10); caching and a correct `Referer` are done by the proxy (D-8).
- **Fair-use measures:** sources exist only while active (FR-12); raster `maxzoom` 17 (the cap
  is from the spec for OpenTopoMap and a conservative assumption for Waymarked Trails); no
  prefetch, seeding or bulk download; each tile is fetched upstream once per TTL for all
  users; identifying `User-Agent` and `Referer` (D-8); per-IP limit against slow scraping
  through the proxy (D-10).
- **Concerns:** OpenTopoMap's legal page was only partly readable ("no caching rule" means none
  found). Both servers are volunteer-run: expect slowness or outages, handled silently (D-6).
  No notice to the operators is planned (user decision).
- **Caching vs terms (checked):** Waymarked Trails asks to cache; OpenTopoMap forbids only
  overloading. Neither forbids on-demand caching; both discourage mass download, which D-8
  and D-10 exclude. Serving cached tiles is redistribution under CC-BY-SA / ODbL with the
  credits unchanged (D-3).

### D-2: Raster and vector coexistence – style swap (FR-2, FR-4, FR-5, FR-12, NFR-6)

- **Choice:** Base map switch calls `map.setStyle(next, { diff: false })`, where `next` is the
  OpenFreeMap style URL or an inline raster style (one `raster` source with three `tiles`,
  `tileSize` 256, `maxzoom` 17, one layer). After each `style.load` the engine re-adds the
  active overlays (hiking first, cycling above it). The camera is not touched (FR-7).
  `setLayers` during a style load only records the target; applied on `style.load`.
- **Alternatives considered:** Keep OpenFreeMap loaded and hide its layers under OpenTopoMap
  (vector tiles may keep loading, breaks FR-12); a second map (view sync).
- **Rationale:** Inactive base map makes no requests, overlays always sit above the base
  (FR-5), the style JSON is browser-cached. A brief flash is accepted (NFR-6: 1 s).
- **Concerns:** Overlays can cover OpenFreeMap labels (spec assumption). A failed style load
  when switching back leaves the map blank, silently (D-6).

### D-3: Attribution – built from the active layers (FR-9, NFR-7)

- **Choice:** Raster sources carry no `attribution`. A pure `creditsFor(state)` returns the
  de-duplicated HTML credit strings of the active layers ("© OpenStreetMap contributors" once).
  The engine passes them as `customAttribution` of `AttributionControl`; the OpenFreeMap style
  adds its own credit. When the credit set changes, the engine removes and re-adds the
  `AttributionControl`, then the layers slot, so the order stays attribution, layers.
- **Collapsed form:** OpenFreeMap only: as today (compact, spec 002 look, AC-2). With OpenTopoMap
  or any overlay the control is `compact: false`, so the share-alike credit is visible text at
  every width; the `globals.css` max-width cap keeps it clear of the right-hand controls.
- **Alternatives considered:** source-level `attribution` (duplicates, compact state hard to
  control); custom attribution UI (licence risk, design 003 D-7); always non-compact (changes
  spec 002 look).

### D-4: Layer control placement – second slot in the top-left stack (FR-1, NFR-4, NFR-5)

- **Choice:** The engine adds a second `SlotControl` (`layersSlot`) at `"top-left"` after the
  attribution; React portals `LayerControl` into it (as `controlsSlot`, design 003 D-4).
  MapLibre stacks it under the attribution however tall that gets (AC-15); the failure state
  has no slot (FR-14).
- **Layout rules:** from 640 px width and ~480 px height up, four full tiles; below that a
  compact 44 px disclosure button revealing the tiles. Must fit between the attribution and the
  bottom input at 320 x 568 and 568 x 320 without scrollbars. Targets at least 44 x 44 px;
  state by check mark/border plus text (FR-6); `FOCUS_RING_CLASS_NAME`; 4.5:1 text, 3:1
  boundaries (opaque white tiles).
- **Alternatives considered:** absolute left overlay (breaks with a tall attribution); fixed
  reserved area (wastes space).

### D-5: Controls – Base UI RadioGroup + Toggle, state in `MapView` (FR-2, FR-6, FR-8, FR-10)

- **Choice:** Base maps: `RadioGroup` + `Radio`; overlays: `Toggle` (`aria-pressed`), from the
  installed `@base-ui/react` 1.9.0 (`toggle` verified). Group named by message `layers.group`.
  Re-selecting the active radio is a no-op (FR-2). `LayerState` is `useState` in `MapView`
  (survives locale changes, design 003 D-3), applied in an effect keyed on engine and state;
  the engine starts with the default state (FR-3). No persistence (out of scope).
- **Labels:** product names are constants next to a single `LAYERS` list (like `APP_NAME`);
  descriptions and overlay names are messages.
- **Alternatives considered:** `Checkbox`/`Switch` for overlays; a layer/icon library.

### D-6: Failure of optional layers is silent (FR-13, FR-14)

- **Choice:** The engine's `error` handler already ignores errors after the first style load;
  keep that. Failed raster tiles (including proxy 429/502) are ignored by MapLibre. No new
  callback or message. `onFailure` stays reserved for the initial OpenFreeMap load (spec 002
  FR-11, FR-14). The "first style loaded" flag must stay true after later `setStyle` calls.

### D-7: Czech Republic only (user-approved change of a spec assumption)

- **Change:** The spec 005 assumption "layers are not restricted to the Czech Republic" is
  replaced by: limited to the Czech Republic. The analyst must update the spec (not edited here);
  it also narrows spec 002's assumption that users may pan outside the country.
- **Choice:** (a) `maxBounds` = Czech bbox (`MAP_CONFIG.czechBounds`) plus a small margin, for
  the vector base map too; (b) every raster source declares `bounds` = Czech bbox; (c) the
  proxy rejects tiles outside the bbox (D-8), so the limit holds for modified clients.
- **Concerns:** Initial `fitBounds` is unchanged; verify `maxBounds` does not break it at 320
  and 1920 px.

### D-8: Caching tile proxy for OpenTopoMap and Waymarked Trails (FR-12, FR-13, NFR-1)

- **Choice:** Route Handler `GET /api/tiles/{layer}/{z}/{x}/{y}` (Node runtime; layer is
  `opentopomap | hiking | cycling`). Raster sources use this absolute URL (from
  `window.location.origin`). `src/proxy.ts` already excludes `/api`. Pipeline:
  1. **Rate limit (D-10)** before any other work; over limit -> 429.
  2. **Validate:** layer in allow-list; `z`, `x`, `y` plain integers, `z` within the layer's
     range, `x`, `y` < 2^z, tile intersects the Czech bbox; else 400/404. The upstream URL is
     built only from the allow-listed host table plus these numbers (no open relay).
  3. **Cache lookup** via `TileStore`. Fresh (age < TTL) -> serve.
  4. **Miss/stale:** fetch upstream on demand only, single-flight per tile, global upstream
     concurrency cap, timeout, `User-Agent` and `Referer`. No prefetch of neighbours or zoom
     levels, no seeding, no bulk/offline mode.
  5. **Validate upstream (boundary):** status 200, `image/png`, PNG signature, size cap;
     otherwise nothing is stored. Store, then serve.
  6. **Errors:** upstream failure/429/5xx with a stale copy -> serve it (stale-if-error);
     without -> 502 (upstream 404 -> 404). Errors are `no-store`. No retry loops.
- **Response headers:** `Content-Type: image/png`, `Cache-Control: public` with browser
  `max-age` about a day plus `stale-while-revalidate` (config), `X-Content-Type-Options:
  nosniff`.
- **Identification:** `User-Agent: GeoGrind/<version> (+<contact URL>)` from `TILE_CONTACT_URL`;
  `Referer` = `SITE_URL` (Waymarked Trails asks for a correct referrer).
- **TTL:** at least 7 days (config). Stale tiles are refetched in full (no ETag bookkeeping).
- **Storage:** `TileStore` interface (below). Default `FileTileStore`: directory
  `TILE_CACHE_DIR` (default `.cache/tiles`, git-ignored), layout `<layer>/<z>/<x>/<y>.png`,
  freshness from mtime, atomic writes (temp file + rename), size limit `TILE_CACHE_MAX_MB`
  with throttled oldest-first eviction. Hosting can move the directory or supply another store.
- **Alternatives considered:** direct browser requests (every user hits the volunteer servers,
  no referrer control); `fetch` data cache (location/size not controllable); separate tile
  server (more parts).
- **Concerns:** Needs a persistent disk and a Node server (already required, design 001);
  ephemeral hosts lose the cache (slower, works) and need another `TileStore`.

### D-9: OpenFreeMap stays direct (recommendation)

- **Choice:** The browser loads the OpenFreeMap style, tiles, glyphs and sprites straight from
  OpenFreeMap; not proxied or cached by the app.
- **Rationale:** A CDN built for direct use with no stated caps; the style references many URLs
  that would need rewriting; proxying adds load for no fairness gain. Keeps spec 002 behaviour.
- **Revisit** if OpenFreeMap changes terms or reliability (the `TileStore` allows it).

### D-10: Per-IP rate limit on the tile proxy (**blocker for public hosting, not for local development**)

- **Why:** The cache and bbox bound the load on upstream, but a public proxy would still let a
  script slowly download the whole Czech Republic, which OpenTopoMap and Waymarked Trails
  discourage and which would breach their terms (D-1 condition (c)).
- **Choice:** A fixed-window counter per client key, checked first in the handler (every
  request counts, hit or miss, valid or not). Two windows, both must pass: per minute (burst,
  covers a screenful of tiles with several layers while panning) and per hour (sustained,
  stops slow scraping). Over the limit -> `429` with `Retry-After` (whole seconds until the
  violated window resets), `Cache-Control: no-store`, empty body. MapLibre treats it as a silent
  tile error (D-6); the browser's own cached tiles do not reach the server and cost nothing.
- **Defaults (tunable, env):** 300 requests/minute and 4000/hour per client (about 70 per
  minute sustained; a normal session loads far less because of browser caching). Revisit after
  seeing real traffic. `TILE_RATE_LIMIT_PER_MINUTE`, `TILE_RATE_LIMIT_PER_HOUR`; `0` disables
  that window (intended for local development only; also the default when
  `NODE_ENV !== "production"`).
- **Interface:** `RateLimiter` (below), default `MemoryRateLimiter` (in-process `Map`, expired
  windows purged, entry count capped so spoofed keys cannot exhaust memory). Per-process only:
  with several instances or serverless, implement `RateLimiter` over a shared store (e.g. a
  free Redis/KV tier) without touching the handler.
- **Client IP behind a reverse proxy/CDN:** a route handler has no socket address, so the IP
  comes from a header and spoofing is the main risk. `clientKey(headers, config)` (pure):
  - `TILE_CLIENT_IP_HEADER` names the single header the deployment's proxy sets and overwrites
    (e.g. `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`). Other headers are ignored.
  - For `x-forwarded-for`, `TILE_TRUSTED_PROXY_HOPS` (default 1) selects the entry counted
    from the right, so client-supplied left entries are ignored.
  - Value is parsed as an IP; IPv6 is keyed by its /64 prefix; missing or invalid value ->
    shared key `unknown` (fail closed: one global bucket, never unlimited).
  - In production with the header unset, log a startup warning. Hosting docs (README) state the
    required setting; the proxy must strip any client-supplied value of that header.
- **Alternatives considered:** limiting in a CDN/WAF (free tiers exist, but host-specific and
  not testable here; may be added on top); `middleware`/`proxy.ts` limiting (same logic, but
  the handler is where the allow-list and config already live); token bucket (more state, no
  better for this purpose); CAPTCHA or auth (out of scope).
- **Recommendation:** The developer implements T-9 now, right after T-8: it is small and pure,
  and a hosting-time rush would risk it being skipped. It is only a *hosting blocker*: the
  default (no limit outside production) keeps local development unaffected.

### D-11: Open source licence (MIT) (D-1 condition (a))

- **Choice:** MIT licence: `LICENSE` file ("Copyright (c) 2026 Jakub Holeček"), `"license":
  "MIT"` in `package.json`, a licence note in `README.md`. The public repository
  `kubiksk8ter/geogrind` had no licence, which does not satisfy "open source".
- **Note:** MIT covers the app's code only; map data and tiles keep their own licences (D-3).

## Dependencies

| Package | Version | Purpose | Install / bundle size |
|---|---|---|---|
| (none new) | – | `maplibre-gl` 6.16.0 and `@base-ui/react` 1.9.0 already installed; the proxy and limiter use Node built-ins (`node:fs/promises`, `node:net`, `fetch`) | no change |

## Components

| Component | Responsibility | Folder |
|---|---|---|
| Layer definitions | `LAYERS`, raster source specs, inline topo style, `creditsFor`, defaults (pure) | `src/map/` |
| MapEngine (extended) | `layersSlot`, `setLayers`, style swap, overlay add/remove, attribution rebuild | `src/map/` |
| LayerControl | Base UI radio cards + toggle cards, compact mode | `src/components/layer-control/` |
| MapView | Holds `LayerState`, applies it to the engine, portals `LayerControl` | `src/components/map/` |
| Messages | `layers.*` keys in both languages | `messages/` |
| Tile proxy route | `GET /api/tiles/{layer}/{z}/{x}/{y}`: limit, validation, cache, upstream (D-8) | `src/app/api/tiles/` |
| Tile service | Validation, upstream fetch, `TileStore`, `FileTileStore`, eviction | `src/tiles/` |
| Rate limiter | `RateLimiter`, `MemoryRateLimiter`, `clientKey` (D-10) | `src/tiles/` |
| Licence files | `LICENSE`, `package.json` field, README note (D-11) | repository root |

## Data flow

1. `MapView` creates the engine (default state, FR-3), stores `layersSlot`, portals `LayerControl`.
2. User picks a base map or toggles an overlay -> state -> effect -> `engine.setLayers(state)`.
3. Engine diff: base changed -> `setStyle(..., { diff: false })`, overlays re-added on
   `style.load`; only overlays changed -> add/remove source+layer (deferred if style loading).
4. Credit set changed -> engine rebuilds the attribution (D-3).
5. Language switch: labels only; state and engine untouched (FR-8).
6. Errors: optional-layer tile errors ignored (D-6); initial OpenFreeMap failure -> `onFailure`
   -> `MapFailure`, no slot (FR-14).
7. Raster tile: MapLibre requests `/api/tiles/...` (inside the bbox only) -> client key ->
   rate limit (429 + `Retry-After` if exceeded) -> validation -> disk hit, or single upstream
   fetch + store (D-8, D-10).

## Interfaces

```ts
// src/map/layers.ts (pure, no MapLibre import)
export type BaseMapId = "openfreemap" | "opentopomap";
export type OverlayId = "hiking" | "cycling";
export interface LayerState {
  readonly baseMap: BaseMapId;
  readonly overlays: Readonly<Record<OverlayId, boolean>>;
}
export const DEFAULT_LAYER_STATE: LayerState; // openfreemap, both overlays off
export function creditsFor(state: LayerState): readonly string[]; // HTML, de-duplicated

// src/map/types.ts (additions)
export interface MapEngine {
  readonly controlsSlot: HTMLElement;
  readonly layersSlot: HTMLElement; // top-left stack, below the attribution
  setLayers(state: LayerState): void; // declarative, idempotent
  destroy(): void;
}

// src/tiles (server only)
export type TileLayer = "opentopomap" | "hiking" | "cycling";
export interface TileCoord { z: number; x: number; y: number }
export function parseTileRequest(
  layer: string, z: string, x: string, y: string,
): { layer: TileLayer } & TileCoord | null; // null = reject (allow-list, ints, range, bbox)
export interface StoredTile { body: Uint8Array; fetchedAt: Date }
export interface TileStore {
  get(layer: TileLayer, c: TileCoord): Promise<StoredTile | null>;
  put(layer: TileLayer, c: TileCoord, body: Uint8Array): Promise<void>; // atomic
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }; // >= 1
export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>; // async so a shared store can replace it
}
export interface ClientIpConfig { header: string | null; trustedHops: number }
export function clientKey(headers: Headers, cfg: ClientIpConfig): string; // IP, /64, or "unknown"
```

Raster source specs and credit strings are constants in `src/map/` (`MAP_CONFIG`). Upstream
URL templates and layer ranges live in `src/tiles/` (server only). Upstream tile bytes are the
only external data parsed; validated as in D-8 step 5.

Environment (server only, documented in `.env.example`): `TILE_CACHE_DIR`, `TILE_CACHE_MAX_MB`,
`TILE_CONTACT_URL` (falls back to `SITE_URL`), `SITE_URL`, `TILE_RATE_LIMIT_PER_MINUTE`,
`TILE_RATE_LIMIT_PER_HOUR`, `TILE_CLIENT_IP_HEADER`, `TILE_TRUSTED_PROXY_HOPS`. All have safe
defaults (rate limit: off outside production, D-10).

Credit strings (wording fixed by NFR-7 and D-1): OpenTopoMap -> "© OpenStreetMap contributors,
SRTM | Map style: © OpenTopoMap (CC-BY-SA)"; overlay -> "© waymarkedtrails.org" and "©
OpenStreetMap contributors". Messages (both files): `layers.group`,
`layers.openfreemap.description`, `layers.opentopomap.description`, `layers.hiking.name`,
`layers.cycling.name`, a compact-mode disclosure label.

## External services

| Service | Purpose | Free-tier limits | Key / config |
|---|---|---|---|
| OpenFreeMap | Vector base map (existing) | No caps, no SLA | none; `MAP_CONFIG.styleUrl` |
| OpenTopoMap | Outdoor raster base map | Fair use, no SLA, small server | none; via proxy (server) |
| Waymarked Trails | Hiking, cycling overlays | Only open-source, non-commercial apps; moderate rates; cache + referrer | none; via proxy (server) |

## Error handling

- Optional-layer tiles fail or server down -> silent, rest of the map works (FR-13, AC-12).
- Initial OpenFreeMap failure -> spec 002 message, no control (FR-14, AC-13); failure when
  switching back -> silent (D-6).
- Upstream 429/403/outage -> stale copy if any, else 502; no retry loop (D-8).
- Client over the rate limit -> 429 + `Retry-After`, no upstream call (D-10); client IP missing
  or invalid -> shared `unknown` bucket.
- Invalid or out-of-bbox tile request -> 400/404 without upstream call (D-7, D-8).
- Disk full/unwritable -> serve the upstream response unstored, log; unreadable file = miss.
- `setLayers` during a pending style load -> deferred, last call wins.

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1 / AC-1 | T-4, D-4 |
| FR-2, FR-3 / AC-2, AC-3 | T-1, T-2, T-4 |
| FR-4, FR-5 / AC-4, AC-5 | T-2 (D-2), T-4 |
| FR-6 / AC-6 | T-4 |
| FR-7 / AC-7, NFR-6 | T-2, manual |
| FR-8 / AC-8 | T-4, T-5 |
| FR-9, NFR-7 / AC-9 | T-1, T-3 (D-3) |
| FR-10, FR-11 / AC-10 | T-4, T-5 |
| FR-12 / AC-11 | T-2 (D-2), manual network check |
| FR-13, FR-14 / AC-12, AC-13 | T-2 (D-6), T-4 |
| NFR-1 / AC-18 | D-1, D-8, D-9, D-10, D-11, T-9, T-10 |
| Revision: Czech-only layers | D-7, T-6 |
| Revision: caching proxy | D-8, D-9, T-7, T-8 |
| Revision: rate limit (Waymarked Trails "moderate rates") | D-10, T-9 |
| Revision: open-source licence (Waymarked Trails condition (a)) | D-11, T-10 |
| NFR-2 | T-5 |
| NFR-3 / AC-14 | T-4, manual |
| NFR-4, NFR-5 / AC-15, AC-16 | D-4, T-3, T-4, manual |
| NFR-8 / AC-17 | manual in four browsers |

## Implementation plan

1. **T-1: Layer definitions** – `src/map/layers.ts`: types, `LAYERS`, `DEFAULT_LAYER_STATE`,
   source config in `MAP_CONFIG`, inline topo style, `creditsFor`. Done when: unit tests pass.
   Covers: FR-3, FR-9, NFR-7.
2. **T-2: Engine layers** – `layersSlot`, `setLayers` (style swap, overlay add/remove, deferral
   until `style.load`, silent errors); update fakes. Done when: a temporary call switches base
   map and overlays without view change; no requests for inactive sources. Covers: FR-2, FR-4,
   FR-5, FR-7, FR-12, FR-13.
3. **T-3: Attribution rebuild** – from `creditsFor` (`compact: false` with a share-alike
   layer), keep order with the layers slot and the `globals.css` cap. Done when: credits match
   all combinations, visible at 320 px with a share-alike layer, collapsed as before with
   OpenFreeMap only. Covers: FR-9, NFR-7, NFR-4.
4. **T-4: LayerControl** – Base UI tiles, compact mode, state in `MapView`, portal into
   `layersSlot`. Done when: all combinations work by mouse, touch, keyboard; no overlap at
   320/768/1920 px in both orientations; 44 px targets. Covers: FR-1, FR-2, FR-4, FR-6, FR-8,
   FR-10, FR-14, NFR-3–5.
5. **T-5: Messages, tests, version** – `layers.*` in `cs.json`/`en.json`, tests below, manual
   checks, version bump per the versioning policy, update `docs/architecture.md` on deviation.
   Done when: `npm test`, lint, typecheck, build green. Covers: FR-10, FR-11, NFR-2. (Last.)
6. **T-6: Czech-only bounds** – `maxBounds` and raster `bounds` (D-7). Done when: camera cannot
   leave the country, initial view unchanged at 320 and 1920 px, no raster request outside the
   bbox. Covers: D-7.
7. **T-7: Tile service** – `src/tiles/`: `parseTileRequest`, upstream fetch with validation,
   `TileStore` + `FileTileStore`, env config, `.env.example`, `.cache/` in `.gitignore`. Done
   when: unit tests pass against a temp directory and a fake upstream. Covers: D-8.
8. **T-8: Proxy route and wiring** – `/api/tiles/...` handler, headers, error mapping; point
   raster sources at it. Done when: topo and overlays load via the proxy, a second load makes
   no upstream request, invalid/out-of-bbox URLs are rejected, offline upstream serves cached
   tiles. Covers: D-8, FR-12, FR-13.
9. **T-9: Per-IP rate limit (mandatory before public hosting; recommended now)** – `RateLimiter`,
   `MemoryRateLimiter`, `clientKey`, env config, wire into the handler as its first step, 429 +
   `Retry-After`; README "hosting" section stating the IP header setting. Done when: unit and
   handler tests pass; with limits set low locally the proxy returns 429 with `Retry-After`
   and recovers after the window; the limit is off in development by default. Covers: D-10,
   NFR-1/AC-18. **Blocker for hosting, not for local development.**
10. **T-10: MIT licence** – `LICENSE` ("Copyright (c) 2026 Jakub Holeček", standard MIT text),
    `"license": "MIT"` in `package.json`, licence mention in `README.md` (code only; map data
    keeps its licences). Done when: all three exist and agree. Covers: D-11, D-1 (a).
    Independent of the other tasks; do before making the app public.

Order: T-1, T-2, T-3, T-4, T-6, T-7, T-8, T-9, T-10, T-5.

## Testing

Vitest (jsdom; MapLibre is not run in jsdom):

- `creditsFor`: all 8 combinations -> expected credits, OSM once, none for inactive (AC-9).
- Layer definitions: https templates, `maxzoom` set, unique ids.
- `MapView` with a fake engine (`layersSlot` div, `setLayers` spy): default state first;
  selecting/toggling calls `setLayers` correctly; re-selecting is a no-op; after `setLocale`
  state is kept, factory called once, `destroy` never (AC-3, 4, 8).
- `LayerControl`: group name, radio/toggle roles and states per language (AC-10); keyboard
  (AC-14); failure -> no group (AC-13).
- Messages parity test covers the new keys (NFR-2).
- `parseTileRequest`: valid Prague tile; non-numeric, negative, decimal, `..`, `1e2`, oversized,
  z too high, unknown layer, outside bbox -> rejected.
- Tile service (temp dir, fake `fetch`): miss stores and serves; hit makes no upstream call;
  stale refetches; stale served on upstream failure; single-flight; non-PNG/oversized not
  stored; atomic write; eviction under the limit; `User-Agent`/`Referer` sent; unwritable dir
  still serves.
- `MemoryRateLimiter` (fake clock): allows up to the limit, then denies with correct
  `retryAfterSeconds`; both windows enforced; window reset allows again; keys independent; `0`
  disables; entry cap holds under many keys.
- `clientKey`: configured header used, others ignored (spoofed `x-forwarded-for` ignored when
  another header is configured); hop selection from the right; invalid/missing -> `unknown`;
  IPv6 /64 grouping; IPv4-mapped IPv6.
- Route handler: status and `Cache-Control` per path; 429 has `Retry-After` and `no-store`
  and makes no cache or upstream call; limit checked before validation.
- Licence: a test (or lint check) that `package.json` `license` is `MIT` and `LICENSE` exists.

Manual: AC-1, 5, 7, 11 (network inspector), 12 (block a tile host), 14, 15, 16, 17 (four
browsers, 320/768/1920 px, both orientations, expanded attribution), contrast, over-zoom beyond
17; before hosting: 429 behind the real reverse proxy/CDN with the configured IP header, and
two different clients get separate buckets.

## Risks / open questions

- **Constraint: Waymarked Trails' terms exclude ads, affiliate income and, in practice, paid
  features.** Adding any of them, or making the repository private or non-open-source, would
  make the overlays unusable; they would have to be removed or replaced. Specs must respect this.
- OpenTopoMap and Waymarked Trails are volunteer-run with no SLA; heavy traffic could breach
  fair use despite cache and limit. Mitigation: lower limits, longer TTL, OpenTopoMap backup
  server.
- Rate limit defaults (D-10) are estimates; tune after real traffic. An in-memory limiter is
  per process; multi-instance hosting needs a shared `RateLimiter`.
- Users behind one NAT/CGNAT share an IP and a bucket; the defaults leave headroom.
- Spec 002 allowed panning outside the country; D-7 removes that (user-approved). The analyst
  updates spec 005 (and notes the effect on 002).
- Cache on an ephemeral host is cold after each deploy; needs another `TileStore`.
- Verify in T-2/T-3 that `setStyle(..., { diff: false })` keeps the camera and that rebuilding
  `AttributionControl` does not flicker (it is rebuilt only on credit change).
- Waymarked Trails max zoom assumed 17 (conservative); raise if higher levels are confirmed.
- Brief blank frame on base-map switch; MapLibre keeps the old style until the new `style.load`.
