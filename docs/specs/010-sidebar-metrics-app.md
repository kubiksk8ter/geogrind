# 010 – Side panel "Metrics" tab, phase 2: Application

- **Status:** Draft
- **Date:** 2026-11-16
- **Next agent:** architect

## Original request

Brief for the analyst (translated from Czech; same branch feature/sidebar-metrics, follows spec
009 and design 009, phase 1 done and committed):

Extend the Metrics tab with a second group "Application", a sibling of the "AI" group of phase 1.
The `/api/metrics` payload is already grouped by source, so the existing "ai" group does not
change.

1. Command results (hand-drawn SVG pie with a small legend beside it):
   - Share of today's commands by result: successful, unsupported, not_found, wait,
     too_many_requests, ai_resting, error.
   - Source: the codes the command handler already returns (`COMMAND_ERROR_CODES` in
     `src/shared/commandContract.ts`).
   - Drawn by hand in SVG, no library. Must work without telling colours apart (legend with
     numbers, contrast).
2. Command latency (mini sparkline): processing time (the handler already measures it as
   `durationMs`) over the last hour: median and p95 and a small SVG sparkline.
3. Real-time load: commands in the last minute and hour, number of active clients (count only,
   never IPs) and commands in progress (`inflightUntil` already exists in state).
4. Service status (two lights):
   - Green and red light for the map and for Nominatim, with a native title ("Service is
     available" / "Service is not available").
   - No extra calls. Map: the status arises in the browser from MapLibre (tile loading errors),
     so it is the status for this visitor and is known at once. Nominatim: derived from the
     result of the last geocoder call on the server (in memory, unknown after a restart); a
     command that did not call the geocoder (e.g. unsupported) does not change the status.
   - If a service status is unknown (Nominatim before the first relevant command), the sentence
     from phase 1 is shown ("Data appears after the first command." - CZ/EN texts as existing).

Out of scope for phase 2: geocoder latency and queue (RequestSpacer); client-side map metrics
other than availability, visitors, history longer than the in-memory window; logging to
`.data/logs.json` (a future feature: error states with time only, max 500-1000 records; unrelated
to phase 2, the spec must only not prevent adding it later).

Keep: CZ/EN texts, style and sizes of phase 1 (uniform headings, `text-sm` base, `hr` dividers,
panel width `md:w-76`), accessibility (charts have a text equivalent), privacy (no query content,
no IPs), reading metrics must not affect limits or the cap.

Questions for the architect: where to keep the sliding window (in-memory ring buffer, empty after
restart) and day totals, where to measure (one place in the command handler), how to learn the
map status in the browser and get it into the Metrics tab, how often to refresh (phase 1 polls
every 10 s). Version: the developer bumps it per the versioning policy.

No clarifying questions were needed; defaults are listed under *Assumptions*.

## Goal

Let anyone see how the app itself behaves: what happens to commands, how fast they are handled,
how busy the app is and whether the map and the geocoder work. It makes a failing command
explainable and lets the owner of the demo watch health without server logs.

## Scope

### In scope

- A second group "Application" in the Metrics tab, below the "AI" group, with four items:
  command results pie, latency, real-time load, service status.
- Collecting, per processed command, its result code and processing time, without any content.
- Service status of the map (per visitor, from the browser) and of Nominatim (server, memory).
- Extending the metrics snapshot with a sibling group; the "ai" group is unchanged.
- Empty, partly known and failure states; CZ/EN texts for everything added.

### Out of scope

- Geocoder latency and queue (RequestSpacer), possibly later.
- Map metrics other than availability; visitors; history longer than the in-memory window.
- Logging to `.data/logs.json` (future; only error states with time, max 500-1000 records).
  This spec must not prevent adding it later.
- Any change to the command flow, cooldown, rate limits, daily cap or the "AI" group.
- Controls, alerts or notifications; per-user, per-IP figures; query content.

## User stories

- As a visitor, I want to see how commands end today so that I understand how often the app
  refuses or fails.
- As the owner of the demo, I want median and p95 latency of the last hour so that I notice a
  slowdown.
- As the owner, I want to see current load (last minute, last hour, active clients, in progress)
  so that I know whether the demo is busy.
- As a visitor, I want a clear map and geocoder status so that I know whether a failure is on
  the service side.

## Functional requirements

- FR-1 Group: the Metrics tab shows a group "Application" after the "AI" group, separated like
  the other items. The "AI" group, its data and behaviour (spec 009) are unchanged. Panel
  layout, size and the small/large screen behaviour are unchanged.
- FR-2 Results pie: shows the share of commands processed today (UTC day, as the daily cap) by
  result: successful, `unsupported`, `not_found`, `wait`, `too_many_requests`, `ai_resting`,
  `error`. It is an SVG pie drawn without a chart library, with a small legend beside it
  (narrow layouts may place it below). Each legend row has the localised result name, the count
  and the percentage. Results with 0 commands stay in the legend with 0 (or are omitted from the
  pie only).
- FR-3 Pie rules: requests rejected before processing as `invalid_request` (e.g. bad body,
  foreign origin) are not counted anywhere in this group. With 0 commands today the pie is not
  drawn and the item shows "no data" (never an empty or full circle as a stand-in). With one
  result at 100 % the pie is still drawn correctly.
- FR-4 Pie without colour: meaning never rests on colour alone; every segment is identifiable
  from the legend by its number (after review the user chose plain colours: no patterns or
  hatching), and the legend gives the exact counts. The pie has an accessible name and a text equivalent with all counts.
- FR-5 Latency: shows, for commands processed in the last 60 minutes, the median and the 95th
  percentile of processing time (the time the command handler measures per command) in ms (or
  s when large), and a small SVG sparkline of processing time over that hour. The sparkline has
  a text equivalent (median, p95, number of commands, time span). The figures appear from the
  first command (there is no minimum count); only with no command in the hour the item shows
  "no data", not 0.
- FR-6 Load: shows the number of commands in the last minute, the number in the last hour, the
  number of active clients (distinct clients with a processed command in the last 60 minutes, the
  same hour as the other figures) and the number of commands being processed now. Clients are only
  counted, never identified: no IP, no identifier is stored for or sent to the metrics.
- FR-7 Service status: two lights, "Map" and "Nominatim" (names shown as text next to each
  light). Available is green, unavailable is red, unknown is grey. After review the user chose
  plain dots without icons; each light keeps a text label next to it. Each light has a native `title`: "Service is
  available" / "Service is not available" (CZ: "Služba je dostupná" / "Služba není dostupná").
- FR-8 Map status: arises in the visitor's browser from the map's own tile loading outcome. It
  is the status for this visitor only, is known as soon as the map has started, and needs no
  call to the server or any extra request. Tile loading errors make it unavailable; it returns
  to available when tiles load again. It is not sent to the server or shown to other visitors.
- FR-9 Nominatim status: derived on the server from the result of the last geocoder call
  made while processing a command (available when the geocoder answered, unavailable when the
  call failed). A command that did not call the geocoder (e.g. `unsupported`) does not change
  it. It is kept in memory only, shared by all visitors, and is unknown after a restart. No
  extra call is made to check it.
- FR-10 Unknown status: when a service status is unknown (Nominatim before the first relevant
  command), the light is not shown as green or red; the item shows the phase 1 sentence "Data
  appears after the first command." (existing CZ/EN text).
- FR-11 Empty and partial states: before any command after a start, the items of FR-2, FR-5 and
  FR-6 show their localised empty state (existing sentence of phase 1) or "no data"; each item
  shows what is known; no unknown value is shown as 0 or 100 %. The count of commands in
  progress and of the last minute are known (0) once the server runs.
- FR-12 Freshness and failure: the group uses the same delivery, polling interval, failure
  handling (keep last figures, mark out of date, retry) and visibility rules as phase 1
  (spec 009 FR-12, FR-13); a failed fetch affects the "AI" and "Application" groups alike,
  except the map status, which does not depend on it.
- FR-13 No side effects: reading the metrics makes no call to Groq, Nominatim or other
  service, and does not count toward the cooldown, rate limits, the daily cap, the active
  clients, the commands in progress or any of the figures above.
- FR-14 Data content: only numbers, times, result codes and service states are stored for or
  sent to the metrics. Typed text, place names, model output, IP addresses, client identifiers
  and raw errors are never stored for or sent to the metrics.
- FR-15 Access: same rules as spec 009 FR-15 (same origin, read-only, one error shape, public
  figures).
- FR-16 Texts: group heading, item titles, result names, legend, units, labels of lights,
  titles, empty, "no data" and accessible names exist in Czech and English, follow the language
  switch at once without a new fetch, and numbers are formatted for the current language.

## Non-functional requirements

- NFR-1 Cost: no new paid service; no extra calls to any external service to obtain figures.
- NFR-2 Localisation: see FR-16.
- NFR-3 Accessibility: keyboard-operable where interactive, visible focus in the project's blue
  glow style; charts and lights have a text equivalent; meaning not by colour alone; text
  contrast 4.5:1, graphic boundaries (pie segments, sparkline, lights) 3:1; updates are not
  announced as interruptions.
- NFR-4 Motion: changes of the pie, sparkline and numbers respect reduced motion as in spec 004.
- NFR-5 Privacy: see FR-14; no cookies or identifiers are added; nothing is written to the
  browser's storage.
- NFR-6 Robustness: collecting metrics never fails, slows or changes the result of a command;
  a bad or missing value degrades to "no data" for that item only. Memory use of the window is
  bounded regardless of traffic.
- NFR-7 Persistence: the sliding window (last minute/hour, latency) is in memory and empty after
  a restart. The architect decides what else survives a restart (e.g. today's result counts) and
  records it. Whatever does not survive is shown as unknown or labelled so that partial data is
  never presented as the full day.
- NFR-8 Consistency: style and sizes as phase 1 (uniform headings, `text-sm` base, `hr`
  dividers, panel width of spec 009); no change to the tab structure.
- NFR-9 Extensibility: the new group is a sibling in the grouped snapshot; no existing group or
  the tab structure changes; the design leaves room for later logging of error states (see
  out of scope).
- NFR-10 Responsiveness: usable from 320 px up, portrait and landscape, no page scrollbars;
  only the tab content scrolls.
- NFR-11 Browsers: latest Chrome, Firefox, Safari, Edge.
- NFR-12 Testability: counting by result, percentile calculation, window expiry, day rollover,
  active client and in-progress counts, Nominatim status rules and the empty/partial states are
  covered by automated tests with simulated time and without real external calls.

## Acceptance criteria

- [ ] AC-1: Given the Metrics tab, then the group "Application" follows the group "AI"; the
  "AI" group shows the same figures and behaviour as before. (FR-1)
- [ ] AC-2: Given today's commands (simulated): 6 successful, 2 `not_found`, 1 `wait`, 1
  `error`, then the pie shows 60 / 20 / 10 / 10 %, the legend lists all seven results with
  counts 6, 0, 2, 1, 0, 0, 1 and percentages, and the pie is drawn as SVG. (FR-2)
- [ ] AC-3: Given a request rejected as `invalid_request`, then no count in the group changes.
  Given 0 commands today, then no pie is drawn and "no data" is shown; given only successful
  commands, then one full segment is drawn correctly. (FR-3)
- [ ] AC-4: Given the pie viewed in grayscale or by a screen reader, then each result is
  identifiable by legend number and its name, and the text equivalent lists all
  counts. (FR-4, NFR-3)
- [ ] AC-5: Given 20 commands in the last hour with known durations (simulated), then median and
  p95 equal the expected values, the sparkline is drawn and has a text equivalent; commands
  older than 60 min are not included; given a single command, median and p95 both equal its
  duration; with no command in the hour "no data" is shown. (FR-5)
- [ ] AC-6: Given commands at 30 s, 5 min and 50 min ago, then last minute shows 1 and last hour
  shows 3; given one command being processed, in progress shows 1 and returns to 0 when it
  ends; given three distinct clients in the last hour, active clients shows 3. (FR-6)
- [ ] AC-7: Given test data with IP addresses and client identifiers, then none appears in the
  stored figures, the fetch answer or the screen. (FR-6, FR-14, NFR-5)
- [ ] AC-8: Given the map and Nominatim, then each has a dot with a text label
  and the native title in the current language ("Služba je dostupná" / "Služba není
  dostupná", "Service is available" / "Service is not available"). (FR-7, FR-16)
- [ ] AC-9: Given tile loading fails (simulated) in this browser, then the map light turns red
  at once without any server call; when tiles load again it turns green; another visitor's
  light is unaffected. (FR-8)
- [ ] AC-10: Given the geocoder answers, then Nominatim is available; given it fails, then
  unavailable; given a command that does not call it (`unsupported`), then the state is
  unchanged; after a restart (simulated) it is unknown; no extra call is made. (FR-9)
- [ ] AC-11: Given Nominatim status unknown, then its light is neither green nor red and the
  sentence "Údaje se zobrazí po prvním příkazu." / "Data appears after the first command." (as
  existing texts) is shown. (FR-10)
- [ ] AC-12: Given a fresh start with no command, then the pie, latency and the hour figure show
  empty or "no data" states, last minute and in progress show 0, and nothing shows a stand-in
  0 or 100 % for unknown. (FR-11)
- [ ] AC-13: Given the tab is open and a command completes, then the group changes within the
  phase 1 interval; given a failed fetch (simulated), then last figures stay marked out of date
  and the tab recovers by itself; the map light still works. (FR-12)
- [ ] AC-14: Given repeated reads of the metrics, then no Groq, Nominatim or other call occurs
  and no cooldown, rate limit, cap, active client, in-progress or other figure changes.
  (FR-13)
- [ ] AC-15: Given a foreign origin or another method, then the request is rejected and shows
  no figures; given a failure of collecting metrics (simulated), then the command's result and
  timing are unchanged. (FR-15, NFR-6)
- [ ] AC-16: Given the language switch, then every text and number format of the group changes
  at once with no new fetch, and all texts exist in both languages. (FR-16)
- [ ] AC-17: Given keyboard only and a screen reader, then the group is operable, focus uses the
  blue glow style, charts and lights expose a text equivalent; contrast and colour independence
  hold. (NFR-3)
- [ ] AC-18: Given reduced motion, then pie, sparkline and numbers change without animation.
  (NFR-4)
- [ ] AC-19: Given a restart (simulated), then window figures are empty and what the design
  declares persistent is kept; no partial count is presented as the full day. (NFR-7)
- [ ] AC-20: Given a very long run of commands (simulated), then the memory held for the window
  stays bounded. (NFR-6)
- [ ] AC-21: Given widths from 320 px to desktop, portrait and landscape, then there are no page
  scrollbars and only long content scrolls; style and sizes match phase 1. (NFR-8, NFR-10)
- [ ] AC-22: Given the design, when a further group or error logging is added later, then no
  existing group or the tab structure needs to change. (NFR-9)
- [ ] AC-23: AC-2, AC-5, AC-6 and AC-9 pass in the latest Chrome, Firefox, Safari and Edge.
  (NFR-11)
- [ ] AC-24: Tests for AC-2, AC-3, AC-5, AC-6, AC-10, AC-12, AC-14 and AC-19 run with simulated
  time and without real external calls. (NFR-12)

## Assumptions

- The Czech Republic scope does not apply: figures are about the app's own behaviour, not
  places, so no request outside the country is involved.
- "Today" for the pie is the UTC day, like the daily cap and the AI group.
- Counted commands are those the command handler processed (all result codes except
  `invalid_request`). "Successful" means `ok: true`. Latency uses the same set except `wait` and
  `too_many_requests`: these instant rejections never reach the AI and would pull the median
  down, so they are left out of median, p95 and sparkline (user decision) but still count in the
  pie and in the load figures.
- "Active clients" is the number of distinct clients that sent a processed command in the last
  60 minutes, the same window as the other load figures; no separate shorter window is used
  (user decision). Clients are counted without being stored in identifiable form in the metrics.
- "Commands in progress" are the commands currently being processed (state `inflightUntil`).
- Median and p95 are shown from the first command, with no minimum count (user decision).
  Sparkline buckets are chosen by the architect.
- The Nominatim status is "available" when the geocoder answered (including "no result", which
  is a valid answer, mapped to `not_found`) and "unavailable" on network error, timeout, 429 or
  server error from it.
- The map status is "unavailable" on tile loading errors; the exact threshold or debounce
  (e.g. a single failed tile) is the architect's decision, but a single transient error must
  not leave the light red once tiles load again.
- The same per-server, all-visitors, public nature of figures as in spec 009 applies.
- Version bump follows the versioning policy; README is updated by the developer.

## Open questions / risks

- For the architect: where the sliding window and day totals live (ring buffer in memory; which
  totals survive a restart, see NFR-7); one measuring point in the command handler; how the map
  status reaches the Metrics tab (browser-only state); refresh interval (phase 1 uses 10 s).
- Risk: if today's result counts are not persisted, a restart makes "today" incomplete; NFR-7
  requires this not to be shown as a full day (e.g. label "since start").
- Risk: the map status describes only this visitor's connection to the tile source; a regional
  or blocked-network problem may show red while the service is fine. Accepted (per brief).
- Risk: the Nominatim status goes stale (last result may be old); a "last checked" time would
  help. Suggestion (not requested).
- Suggestion (not requested): label the pie "since server start" if not persisted.
- Risk: public figures reveal usage patterns; already noted in spec 009 and the privacy notice
  TODO.
- Recommendation: **architect**. It adds server state (window, status), a measuring point, an
  extended contract and a browser-side status flow across several parts of the app.
