# 007 – Landmark highlight

- **Status:** Draft
- **Date:** 2026-11-10
- **Next agent:** developer

## Original request

Create a spec for GeoGrind: after zooming to a place with the zoom command, highlight the found
object on the map.

User decisions:
- Landmarks and smaller objects are highlighted. Towns and states (and in general
  administrative units / large areas) are NOT highlighted.
- A point result (the geocoder returns a Point) is marked simply by a point, as received from
  the server, with no further computation.
- Polygon / MultiPolygon / LineString are drawn as an outline only, with no fill (a fill made
  touching shapes such as river branches merge into one coloured mass).
- The highlight disappears / is replaced by the next command.
- Small-to-medium change, concise spec. Recommend developer or architect.

Follow-up decisions: the highlight is removed as soon as the next command is sent (a stale
highlight could confuse the user); hotels and other POIs are highlighted; long rivers
(waterway) are highlighted, the user wants to see first how it looks.

## Goal

After "Zoom to Charles Bridge" the user sees not only the new view but also which object was
found, drawn on the map. Towns, regions and countries are not marked.

## Scope

### In scope

- Highlighting the result of the existing zoom command (specs 005, 006) when it is a landmark,
  a POI or a small natural/linear object (FR-1).
- Drawing the geometry the geocoder already returns (point, line, area).
- Removing the highlight when the next command is sent.

### Out of scope

- Markers with icons, popups, labels, photos, descriptions, click behavior.
- Route A to B, new commands, new map layers toggled by the user.
- Extra geocoder requests, or any change to cooldown, limits and messages of spec 005.
- Own calculation of a point for an area, or choosing a "better" point than the server's.

## User stories

- As a user, I want the found monument outlined on the map so that I see exactly what the map
  zoomed to.
- As a user, I want no highlight for a town or country so that the map stays uncluttered.

## Functional requirements

- FR-1: A result is highlighted when it is a landmark or a POI (spec 006 classes), or a natural
  feature, waterway or street (e.g. a peak, a lake, a river, a street). It is NOT highlighted
  when it is an administrative or other large-area result (country, state, region, district,
  town, village, city part, national park or protected area, land-use area). Highlighted
  means: the server delivers the geometry with the zoom result; all other results are
  delivered without geometry.
- FR-2: A Point is drawn as a visible point at exactly the coordinates received from the
  server. No centre or other point is computed.
- FR-3: A Polygon, MultiPolygon or LineString is drawn with an outline only, without a fill. The
  highlight is clearly visible on the map style used and does not hide the map beneath.
- FR-4: The highlight is shown together with the zoom to the object (spec 006 FR-6) and is
  visible for as long as the view stays on it.
- FR-5: Only one highlight exists at a time. The moment the user sends a new command, the
  previous highlight disappears, whatever the outcome (success, error, "place not found",
  cooldown or limit message). Only a successful result with geometry then draws a new
  highlight; a result without geometry (e.g. a town) leaves the map without one.
- FR-6: Geometry detail is sufficient to follow the real shape of a small object (building,
  bridge, street) without visible jaggedness at the zoom of the view. Simplification used for
  the map-view calculation (main-body box of spec 005) must not change the view computed
  today.
- FR-7: The size of the server answer to the browser stays small: geometry too detailed or too
  large to send (over 5,000 positions) is omitted, in which case the zoom still works without a
  highlight. It is not simplified; the limit may be revisited if real use shows it is too tight.
- FR-8: The change adds no geocoder request per command, keeps caching and the 1 request/s
  spacing and the OSM attribution (spec 005, 006 FR-9).
- FR-9: A result without usable geometry (missing, invalid, unexpected type) just zooms as
  before; no error is shown.
- FR-11: The highlight fades out completely and disappears on its own 30 seconds after the map
  has finished moving to the result (the end of the zoom animation, or at once with reduced
  motion). A new command (FR-5) or a new highlight cancels the pending fade and removes or
  replaces the old highlight immediately. Moving the map by hand does not restart the delay.
  The fade itself takes 5 seconds, at the end of the 30 seconds.
- FR-10: The highlight needs no user-visible text. If any text is added (e.g. an accessible
  name), it exists in Czech and English.

## Non-functional requirements

- NFR-1 Cost: no new service or paid plan.
- NFR-2 Localisation: see FR-10.
- NFR-3 Browsers: latest Chrome, Firefox, Safari, Edge.
- NFR-4 Performance: drawing a highlight does not noticeably delay the zoom; the extra answer
  size is bounded (FR-7).
- NFR-5 Testability: the highlight/no-highlight rule and geometry handling are covered by
  automated tests with simulated geocoder answers, without a real geocoder call.
- NFR-6 Motion: the highlight respects the existing reduced-motion behavior (spec 004): with
  reduced motion the highlight disappears at once after the delay (FR-11), with no fade.

## Acceptance criteria

- [ ] AC-1: Given a simulated landmark with a Polygon, when zoomed, then the answer carries the
  geometry and the map shows its outline. (FR-1, FR-3, FR-4)
- [ ] AC-2: Given a simulated landmark with a Point, then a point is drawn at exactly the
  received coordinates. (FR-2)
- [ ] AC-3: Given a LineString (e.g. a street or river), then only an outline is drawn.
  (FR-1, FR-3)
- [ ] AC-4: Given a MultiPolygon landmark, then all its parts are drawn. (FR-3)
- [ ] AC-5: Given a town, village, region, state, country, district or national park, then the
  answer has no geometry and nothing is highlighted. (FR-1)
- [ ] AC-6: Given a hotel or other POI result (spec 006 FR-3), then it is highlighted.
  (FR-1)
- [ ] AC-7: Given a highlight is shown, when a new command is sent, then the old highlight is
  gone immediately; if the command succeeds with a landmark, only the new highlight is
  visible; if it succeeds with a town, no highlight remains. (FR-5)
- [ ] AC-8: Given a highlight is shown, when a new command fails, finds nothing or is rejected
  (cooldown, limit), then the highlight is gone while the view stays unchanged
  (spec 005 FR-10). (FR-5)
- [ ] AC-9: Given missing or invalid geometry, then the map zooms as before and no error
  appears. (FR-9)
- [ ] AC-10: Given a very large or very detailed geometry, then the answer carries no
  highlight, stays within the size bound and the zoom still works. (FR-7)
- [ ] AC-11: Zooming to Tokyo, France or Russia gives the same view as before this change.
  (FR-6)
- [ ] AC-12: One command causes at most one geocoder request; repeating it is served from the
  cache with the highlight. (FR-8)
- [ ] AC-14: Given a highlight is shown, when 30 seconds pass after the map has finished moving,
  then it has faded out completely and is gone from the map (with reduced motion: gone at once
  at that time). (FR-11)
- [ ] AC-15: Given a pending fade, when a new command is sent or a new highlight arrives, then
  the timer is cancelled and the new highlight is shown at full strength for its own 30 seconds.
  (FR-11)
- [ ] AC-13: Tests for AC-1 to AC-10, AC-14 and AC-15 run without a real geocoder call. (NFR-5)

## Assumptions

- Current state: `nominatimGeocoder.ts` already requests geometry (`polygon_geojson=1`,
  tolerance 0.1) but uses it only for the view; the zoom result carries only bounds.
  Spec 005's command result and the map target therefore get an optional highlight geometry.
- FR-1 rule, based on spec 006's classes: highlighted = landmark, POI, and place-tier results
  of category natural, waterway, highway; not highlighted = category boundary, place and
  landuse. A large natural feature (a long river) is highlighted anyway; confirmed by the user.
- Tolerance 0.1 degrees (hundreds of metres) is too coarse for drawing. The developer picks
  a finer value (suggested order 0.0001 to 0.001) or another way to meet FR-6 and FR-7 within
  the single request; the cache keeps the geometry (200 entries, small).
- Search stays as in specs 005/006; the highlight follows the zoom result, with no extra
  restriction for objects outside the Czech Republic (the existing zoom behavior applies).
- Colour and line width are chosen by the developer; they must work on the current map style.
- The version is bumped by the developer according to the versioning policy.

## Open questions / risks

- Risk: geocoder objects are often a single building or a point, so many highlights will be
  small dots; accepted.
- Risk: a finer tolerance enlarges the geocoder answer for big areas; FR-7 bounds what is
  forwarded.
- Risk: long rivers may produce heavy geometry and a barely useful highlight; the user wants
  to judge it first (FR-1 may be narrowed later).
- Suggestion: clearing the highlight when the user moves the map away or via a close control
  is not requested; consider later.
- Recommendation: **developer** is enough. No new module, service or data model; it extends the
  existing zoom result (shared contract), the geocoder, the command-sending flow in the
  browser and the map engine along the current patterns. If the developer finds the size bound
  (FR-7) needs a bigger design, escalate to the architect.
