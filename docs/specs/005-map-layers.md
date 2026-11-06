# 005 – Map layers (base maps and trail overlays)

- **Status:** Draft
- **Date:** 2026-11-06
- **Next agent:** architect

## Original request

> Nová funkce pro GeoGrind (větev feature/map-layers). Zadání od uživatele: implementovat
> jednotlivé vrstvy mapy:
> - OpenFreeMap – vector map style and tiles
> - OpenTopoMap – outdoor base map
> - Waymarked Trails – hiking and cycling overlays
>
> Na levé straně obrazovky mají být dlaždice (radio buttony / karty – konkrétní UI ponecháno na
> agentech) pro přepínání vrstev. Základní mapy (OpenFreeMap, OpenTopoMap) se logicky vylučují;
> overlaye Waymarked Trails (hiking, cycling) by měly jít zapínat nezávisle. Zohledni existující
> kód (mapa, CZ/EN přepínač, Tailwind) a uveď i požadavky na attribution/licence zdrojů.

(English: implement the individual map layers: OpenFreeMap vector style and tiles, OpenTopoMap
outdoor base map, Waymarked Trails hiking and cycling overlays. On the left side of the screen,
tiles (radio buttons / cards, exact UI left to the agents) switch the layers. Base maps exclude
each other; the two Waymarked Trails overlays can be switched on independently. Respect the
existing code and state attribution/licence requirements.)

No clarifying questions were needed; decisions taken instead are listed under *Assumptions*.

## Goal

Let users choose which base map the Czech Republic is shown on (general vector map or outdoor
topographic map) and add hiking and cycling route overlays on top, so that outdoor users can see
trails. Required attribution of every active source is shown.

## Scope

### In scope

- Two mutually exclusive base maps: OpenFreeMap (current map, spec 002) and OpenTopoMap.
- Two independent overlays: Waymarked Trails hiking and Waymarked Trails cycling.
- A layer selection control on the left side of the screen, made of tiles.
- Attribution/licence credit for each active layer.
- Czech and English texts for the new control.

### Out of scope

- Natural-language control of layers (e.g. "Show cycling routes" in the command input, spec 003
  stays UI-only); a later spec connects it to these layers.
- Other overlays (MTB, riding, skating, slopes) and other base maps.
- Overlay opacity sliders, layer ordering by the user, legends, route details or click/hover
  on trails.
- The future side panel (spec 003, FR-14); this control is a standalone left-side element.
- Remembering the selection across page loads.
- Changing the map's initial view, language switch or command input.

## User stories

- As a hiker, I want an outdoor topographic base map so that I see terrain and paths.
- As a cyclist, I want to show cycling routes on the map so that I can plan a ride.
- As a hiker, I want to show hiking trails, with or without cycling routes, so that I can
  combine what I need.
- As a user, I want to switch back to the general map at any time.
- As a user, I want to see who provided the map data so that the licences are respected.

## Functional requirements

- FR-1: While the map is displayed, a layer control is shown on the left side of the viewport,
  on top of the map. It consists of tiles: one for each base map ("OpenFreeMap", "OpenTopoMap")
  and one for each overlay ("Waymarked Trails – hiking", "Waymarked Trails – cycling").
- FR-2: Base maps are mutually exclusive: exactly one is active at any time. Selecting a base
  map tile makes it active and deactivates the other. Selecting the active base map does nothing.
- FR-3: On load, OpenFreeMap is the active base map and both overlays are off, so the initial
  look is unchanged from spec 002.
- FR-4: Each overlay is toggled on and off independently of the other overlay and of the base
  map choice. Any combination (none, hiking, cycling, both) is allowed with either base map.
- FR-5: Overlays are drawn above the active base map. Changing the base map keeps the overlays'
  state unchanged.
- FR-6: Every tile clearly shows whether its layer is active (selected/on or off), not by
  colour alone.
- FR-7: Changing a layer takes effect on the map immediately, without reloading the page, and
  keeps the map view (position and zoom), spec 003 FR-8 style.
- FR-8: Changing the language keeps the layer selection and keeps the map view; tile labels
  switch to the new language.
- FR-9: Attribution: the map's attribution (spec 003, FR-15) always lists the credit of every
  currently active layer and only of those, in the form the source's licence requires (see
  NFR-7). Credits appear/disappear when a layer is activated/deactivated.
- FR-10: Each tile has an accessible name in the current language. The control is a named group
  (cs "Vrstvy mapy" / en "Map layers"); base maps are exposed as a single-choice set and overlays
  as on/off toggles, so assistive technologies announce their state.
- FR-11: Tile labels (visible and accessible) in cs / en:
  - "OpenFreeMap" (same in both languages), with description "Obecná mapa" / "General map";
  - "OpenTopoMap" (same), with description "Turistická mapa" / "Outdoor map";
  - "Turistické trasy" / "Hiking trails" with source "Waymarked Trails";
  - "Cyklotrasy" / "Cycling routes" with source "Waymarked Trails".

  Product/source names are not translated; the wording may be refined in review if both
  languages keep the same meaning.
- FR-12: Layer sources are loaded only when needed: an inactive layer causes no network
  requests to its source.
- FR-13: If tiles of an optional layer (OpenTopoMap or an overlay) cannot be loaded, the map and
  all other layers stay usable and no full-screen failure message is shown. Failure of the
  initial OpenFreeMap load keeps behaving as in spec 002, FR-11.
- FR-14: When the map cannot be loaded (spec 002, FR-11), the layer control is not shown.
- FR-15: The map and all layers are limited to the Czech Republic: the user cannot move the view
  outside the country, and no tiles are requested for areas outside it.

## Non-functional requirements

- NFR-1 (cost): All layer sources are used free of charge, without paid plans. Free tiers or
  keys are acceptable. The architect must confirm that each source's usage policy permits this
  app's use (see *Open questions / risks*).
- NFR-2 (localisation): All texts added by this spec exist in Czech and English (FR-10, FR-11).
  Attribution text is exempt (spec 002 decision).
- NFR-3 (accessibility): The tiles are operable by keyboard (Tab to reach, Space/Enter or
  arrow keys as appropriate for the control type) with a visible focus indicator. Text has at
  least 4.5:1 contrast and control boundaries/selected state at least 3:1, including over the
  map. Layer changes need no pointer hover.
- NFR-4 (responsiveness): From 320 px width to large desktop, portrait and landscape, the
  control is fully visible, does not overlap the attribution (top-left), the zoom buttons and
  language switch (top-right), or the command input (bottom centre), causes no scrollbars and
  does not cover the central part of the map more than necessary. At narrow widths it may be
  compact (e.g. icon-only or collapsible), provided FR-6 and FR-10 still hold.
- NFR-5 (touch): Tile tap targets are at least 44 x 44 px.
- NFR-6 (performance): Switching a layer shows the result within 1 second on broadband, and
  the map stays interactive (pan/zoom) while tiles load.
- NFR-7 (licences/attribution): The credits required by the sources are shown as visible text
  with working links where the licence requires them:
  - OpenFreeMap: "OpenFreeMap" and "© OpenMapTiles", "Data from OpenStreetMap" (as the current
    style provides);
  - OpenTopoMap: "© OpenStreetMap contributors", "SRTM", "Map style: © OpenTopoMap (CC-BY-SA)";
  - Waymarked Trails: "© waymarkedtrails.org" together with "© OpenStreetMap contributors"
    (route data, ODbL).

  The architect verifies the exact wording against the current terms of each source.
- NFR-8 (browsers): Works in the latest Chrome, Firefox, Safari and Edge only.

## Acceptance criteria

- [ ] AC-1: Given the map is displayed at 320, 768 and 1920 px widths, then a layer control with
  four tiles (OpenFreeMap, OpenTopoMap, hiking, cycling) is visible on the left side. (FR-1)
- [ ] AC-2: Given the page has just loaded, then OpenFreeMap is active, both overlays are off,
  and the map looks as in spec 002. (FR-3)
- [ ] AC-3: Given OpenFreeMap is active, when the user selects OpenTopoMap, then the map shows
  OpenTopoMap and OpenFreeMap is no longer active; selecting OpenFreeMap reverses this; selecting
  the already active base map changes nothing. (FR-2)
- [ ] AC-4: Given any base map, when the user turns on hiking, then hiking trails are drawn
  over the map; turning on cycling additionally shows cycling routes; turning either off removes
  only that overlay. All four combinations work with both base maps. (FR-4, FR-5)
- [ ] AC-5: Given overlays are on, when the base map is changed, then the overlays stay on and
  visible above the new base map. (FR-5)
- [ ] AC-6: Given any layer states, then each tile shows active/inactive by a cue other than
  colour alone (e.g. check mark, border or text). (FR-6)
- [ ] AC-7: Given the map is panned and zoomed, when a layer is changed, then the page does not
  reload and the view is unchanged. (FR-7, NFR-6)
- [ ] AC-8: Given a selection of layers, when the language is switched, then the same layers
  stay active, the view is unchanged and the tile labels are in the new language. (FR-8, FR-11)
- [ ] AC-9: Given any combination of active layers, then the attribution (expanded) lists the
  credits of exactly those layers, with the wording and links required in NFR-7; deactivating a
  layer removes its credit. (FR-9, NFR-7)
- [ ] AC-10: Given a screen reader, then the group is named "Vrstvy mapy" / "Map layers", base
  maps are announced as one choice among two with their selected state, and overlays as toggles
  with their on/off state; labels are as in FR-11 in each language. (FR-10, FR-11, NFR-2)
- [ ] AC-11: Given a layer is inactive, when network requests are inspected, then none go to its
  source; they start after activation. (FR-12)
- [ ] AC-12: Given the OpenTopoMap or overlay source is unreachable, when the layer is active,
  then no failure message is shown and the rest of the map still works. (FR-13)
- [ ] AC-13: Given the OpenFreeMap load fails, then the spec 002 failure message is shown and
  the layer control is not present. (FR-14)
- [ ] AC-14: Given keyboard only, then every tile is reachable and operable with a visible focus
  indicator, and contrast meets NFR-3. (NFR-3)
- [ ] AC-15: Given 320, 768 and 1920 px widths in portrait and landscape, then the control does
  not overlap the attribution (also expanded), zoom buttons, language switch or command input,
  and no scrollbar appears. (NFR-4)
- [ ] AC-16: Given a touch device, then each tile's tap target is at least 44 x 44 px. (NFR-5)
- [ ] AC-17: Given the latest Chrome, Firefox, Safari and Edge, then AC-1 to AC-16 and AC-19
  pass in each. (NFR-8)
- [ ] AC-18: Given the design for this spec, then it confirms that each source is usable free
  of charge for this app. (NFR-1)
- [ ] AC-19: Given any layers are active, when the user tries to pan or zoom out beyond the
  Czech Republic, then the view stays within it and no tile requests are made for areas outside
  it. (FR-15)

## Assumptions

- Czech Republic scope (user decision): the initial view stays as in spec 002. The map and all
  layers are limited to the territory of the Czech Republic; the map cannot be panned or zoomed
  outside it and no layer data is requested for areas outside it (FR-15).
- Tile access (user-approved): OpenTopoMap and Waymarked Trails tiles are served through a local
  caching proxy; a tile is downloaded from the source only when a user requests it (no offline
  or bulk downloading); the cache can be moved to a server when the app is hosted. The source
  operators are not notified.
- Defaults and persistence: OpenFreeMap on, overlays off; the selection is not stored and
  resets on reload. Switching language keeps it (FR-8).
- "Tiles" means selectable cards/buttons; radio-like for base maps, switch/checkbox-like for
  overlays. Visual design (thumbnails, icons, size, collapsing) is left to the architect and
  developer. Thumbnail images are optional.
- The control sits on the left, vertically below the top-left attribution and clear of the
  bottom-centre input. The spec 003 side panel is not yet built; moving the control into it
  later is a separate decision.
- Overlays are shown above both base maps; the OpenFreeMap base map's labels may be partially
  covered by overlays. Z-order beyond FR-5 is left to the architect.
- Spec 002 FR-10 ("no other UI elements") and spec 003 FR-6 remain superseded as in spec 003;
  specs 002/003 are not edited. The attribution requirement (spec 002 FR-9) is extended by FR-9.
- Command-input support for layers is out of scope; the "Show cycling routes" placeholder from
  spec 003 still does nothing until a later spec.

## Open questions / risks

- Impact on spec 002: its assumption "Users may pan or zoom outside it" no longer holds once
  this spec is implemented (FR-15). Spec 002 is intentionally not edited; update it separately.
- Risk: usage policies. OpenTopoMap and Waymarked Trails are community-run servers with
  fair-use limits (OpenTopoMap tiles are limited to about zoom 17 and discourage heavy use;
  Waymarked Trails asks for attribution and reasonable use). The architect must check
  they stay free and acceptable for expected traffic (NFR-1) and note maximum zoom per source
  (the map may need to limit or over-zoom the layer).
- Risk: OpenTopoMap and Waymarked Trails are raster tiles; the architect decides how they
  coexist with the vector base map and how attribution updates per layer.
- Risk: OpenTopoMap is licensed CC-BY-SA; the design must keep required credit visible even
  while the attribution is collapsed (spec 003 FR-15 allows a compact form).
- Risk: at 320 px the left control, top-left attribution, top-right controls and bottom input
  compete for space; NFR-4 allows a compact form.
- Suggestion: connect the layers to the command input ("Show cycling routes", "Show hiking
  trails") in a following spec, including behaviour for unsupported commands.
- Suggestion: add a short legend for trail colours and persist the selection (e.g. in the
  browser) in a later spec.
