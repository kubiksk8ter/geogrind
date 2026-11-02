# 002 – Full-screen map of the Czech Republic

- **Status:** Draft
- **Date:** 2026-11-02
- **Next agent:** architect

## Original request

> Jelikož jde primárně o mapovou aplikaci, nejprve dokončíme mapu a teprve na ní budeme stavět
> další funkce a UI. Úkolem je nainstalovat a zobrazit mapu, zatím bez jakékoliv funkcionality.
> Mapa musí pokrývat celou obrazovku, za všech okolností. Výsledek by měl vypadat tak, že po
> spuštění aplikace se na obrazovce zobrazí mapa České republiky.

(English: "Since this is primarily a map application, we will first finish the map, then build
further features and UI on top of it. The task is to install and display a map, for now without
any functionality. The map must cover the whole screen, under any circumstances. The result
should look like this: when the application starts, a map of the Czech Republic is shown on the
screen.")

Context provided with the request: the header and the CZ/EN language switcher are postponed to a
later spec. This spec must define what happens with the intro screen's "GeoGrind" heading from
spec 001.

No clarifying questions were needed for the first draft. User answers to the draft's open
questions:

1. The map provider's attribution text may stay English-only in the Czech version.
2. Add a map-load-failure message to this spec: when the map cannot be loaded, the user sees a
   message in the active language (Czech or English).

## Goal

Replace the intro screen with a full-screen map showing the Czech Republic, so that every later
feature (natural-language commands, layers, UI) is built on top of a working map.

## Scope

### In scope

- A map filling the entire browser viewport on `/cs` and `/en`.
- An initial view showing the whole Czech Republic.
- Standard map interaction provided by the map itself (pan, zoom).
- Keeping "GeoGrind" as the page's main heading for assistive technologies and in the tab title.
- A message in the active language when the map cannot be loaded.

### Out of scope

- Natural-language input and any command handling.
- Map layers, markers, search, geolocation, routing.
- Custom map controls or UI overlays (header, language switcher, buttons).
- Restricting panning or zooming to the Czech Republic (see *Open questions / risks*).
- Retrying a failed map load from within the app (the user reloads the page).
- Choosing the map provider or library (architect's decision, within NFR-1).

## User stories

- As a visitor, I want to see a map of the Czech Republic as soon as the app opens so that I
  immediately know it is a map application for that country.
- As a visitor, I want the map to fill my whole screen on any device so that I get the most
  map area possible.
- As a visitor, I want to be told in my language when the map cannot be loaded so that I am not
  left looking at an empty screen.
- As a member of the development team, I want a working map foundation so that later features
  can be built on it.

## Functional requirements

- FR-1: Opening `/cs` or `/en` shows a map instead of the intro screen from spec 001. The
  redirect from the root address (spec 001, FR-1) is unchanged.
- FR-2: On load, the map shows the whole territory of the Czech Republic, approximately centred
  in the viewport, at the largest zoom at which the whole country is visible.
- FR-3: The map covers the entire browser viewport: no margins, gaps, scrollbars or page content
  around or below it.
- FR-4: The map keeps covering the entire viewport when the window is resized, the device is
  rotated, the browser is zoomed, or browser UI (e.g. a mobile address bar) appears or hides.
- FR-5: The user can pan the map by dragging and zoom it in and out using the map's standard
  interactions (mouse wheel, pinch, keyboard where supported by the map).
- FR-6: The page still has a top-level heading reading "GeoGrind", which is not visible but is
  exposed to assistive technologies. The visible intro screen heading is removed.
- FR-7: The browser tab title still contains "GeoGrind" (spec 001, FR-4 is unchanged).
- FR-8: The map region has an accessible name in the current language: "Mapa České republiky"
  (Czech) / "Map of the Czech Republic" (English).
- FR-9: Attribution required by the map data/tile provider's licence is shown on the map.
- FR-10: Apart from the map (and its attribution and any built-in zoom controls) or the
  load-failure message (FR-11), the screen shows no other UI elements.
- FR-11: When the map cannot be loaded, the full-screen area shows a message in the active
  language instead of the map: "Mapu se nepodařilo načíst. Zkuste stránku načíst znovu."
  (Czech) / "The map could not be loaded. Please try reloading the page." (English). The area
  still covers the entire viewport as required by FR-3 and FR-4.

## Non-functional requirements

- NFR-1 (cost): The map provider and any related service must be free of charge (free tiers
  included, even if they require an API key or account). No paid plan may be required.
- NFR-2 (localisation): All user-visible text defined by this spec (the accessible map name in
  FR-8 and the load-failure message in FR-11) exists in Czech and English. The page continues to
  declare its current language.
- NFR-3 (accessibility): The hidden "GeoGrind" heading remains the page's single top-level
  heading; the map region is reachable and named for assistive technologies. The load-failure
  message is announced to assistive technologies and meets WCAG 2.1 AA contrast (at least
  4.5:1).
- NFR-4 (responsiveness): FR-3, FR-4 and FR-11 hold for viewport widths from 320 px to large
  desktop sizes, in portrait and landscape.
- NFR-5 (performance): On a typical broadband connection, the map of the Czech Republic is
  visible within 3 seconds of opening the page.
- NFR-6 (browsers): Works in the latest version of Chrome, Firefox, Safari and Edge. Older
  versions are not supported.

## Acceptance criteria

- [ ] AC-1: Given the app is running, when a user opens `/cs` or `/en`, then a map is shown and
  the intro screen heading is not visible; when they open `/`, they are redirected as before and
  see the map. (FR-1)
- [ ] AC-2: Given the page has just loaded, then the entire Czech Republic is visible, roughly
  centred, and no part of its border is cut off by the viewport edge. (FR-2)
- [ ] AC-3: Given the page is open at 320 px, 768 px and 1920 px widths, in portrait and
  landscape, then the map touches all four viewport edges and no scrollbar or other page content
  is present. (FR-3, NFR-4)
- [ ] AC-4: Given the map is displayed, when the window is resized, the device is rotated, the
  browser zoom changes, or a mobile browser's address bar shows or hides, then the map still
  covers the whole viewport with no gaps and no scrollbars. (FR-4, NFR-4)
- [ ] AC-5: Given the map is displayed, when the user drags it, scrolls the mouse wheel over it
  or pinches on a touch device, then the map pans or zooms accordingly. (FR-5)
- [ ] AC-6: Given the page is inspected with an accessibility tool, then there is exactly one
  top-level heading, it reads "GeoGrind", and it is not visible on screen. (FR-6, NFR-3)
- [ ] AC-7: Given the page is open in either language, then the tab title contains "GeoGrind".
  (FR-7)
- [ ] AC-8: Given the page is open in Czech, then the map region is announced as "Mapa České
  republiky"; given it is open in English, then as "Map of the Czech Republic". (FR-8, NFR-2)
- [ ] AC-9: Given the map is displayed, then the attribution required by the provider's licence
  is visible on the map. (FR-9)
- [ ] AC-10: Given the map is displayed, then no UI elements other than the map, its
  attribution and built-in zoom controls are visible. (FR-10)
- [ ] AC-11: Given the chosen map provider, then using it for this app requires no paid plan.
  (NFR-1)
- [ ] AC-12: Given a typical broadband connection and an empty cache, when the page is opened,
  then the map of the Czech Republic is visible within 3 seconds. (NFR-5)
- [ ] AC-13: Given the latest Chrome, Firefox, Safari and Edge, then AC-1 to AC-10 and AC-14 to
  AC-16 pass in each. (NFR-6)
- [ ] AC-14: Given the map provider cannot be reached (e.g. the network is blocked after the page
  itself has loaded), when `/cs` is opened, then the message "Mapu se nepodařilo načíst. Zkuste
  stránku načíst znovu." is shown; when `/en` is opened, then "The map could not be loaded.
  Please try reloading the page." is shown. (FR-11, NFR-2)
- [ ] AC-15: Given the load-failure message is shown at 320 px, 768 px and 1920 px widths, in
  portrait and landscape, then the full-screen area touches all four viewport edges, the whole
  message is visible, no scrollbar is present and no other UI element is shown. (FR-10, FR-11,
  NFR-4)
- [ ] AC-16: Given the load-failure message is shown, then it is announced by a screen reader and
  its contrast against the background is at least 4.5:1. (FR-11, NFR-3)

## Assumptions

- The intro screen from spec 001 is replaced by the map. Spec 001's FR-2 (visible heading),
  FR-5 / AC-5 (no map present) and NFR-4 / AC-7 (visible heading at 320 px) are superseded by
  this spec; spec 001 itself is not edited.
- "Without any functionality" means no app-specific features; the map's own standard pan/zoom
  interaction is expected and allowed.
- Built-in zoom controls of the map (if the chosen map has them) are acceptable; their presence
  is not required.
- Czech Republic scope: the initial view is the Czech Republic. Users may pan or zoom outside it;
  the map then simply shows whatever the provider renders there, with no special behaviour. No
  feature in this spec acts on locations outside the Czech Republic.
- Place names on the map are shown as the map provider renders them (typically the local
  Czech names) in both languages; translating map labels is not required.
- Decision (confirmed by the user): the provider's attribution text may stay in its original
  language (typically English) in the Czech version too; it is exempt from the Czech/English
  requirement.
- The visual map style (e.g. standard street map) is left to the architect, as long as country
  borders and major places of the Czech Republic are recognisable.
- While the map is loading, the full-screen area may show a plain neutral background.
- "The map cannot be loaded" means the map cannot be displayed at all (e.g. the provider is
  unreachable, offline, or the map fails to start). Individual missing tiles during normal use
  do not trigger the message.
- The load-failure message has no retry button; it tells the user to reload the page. A retry
  action is not essential because a page reload achieves the same result.
- The exact wording of the load-failure message may be refined during review, provided both
  language versions keep the same meaning.

## Open questions / risks

- Risk: free map tile services often have usage limits or fair-use policies; the architect
  should confirm the chosen provider stays free for the expected traffic.
- Suggestion: restrict panning/zooming to the Czech Republic and its surroundings in a later
  spec, to reinforce the product scope.
- Suggestion: once the header and language switcher are added, decide whether the visible
  "GeoGrind" name returns as part of that header.
