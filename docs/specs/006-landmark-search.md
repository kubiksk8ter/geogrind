# 006 – Landmark search

- **Status:** Draft
- **Date:** 2026-11-10
- **Next agent:** developer

## Original request

Extend place search with major travel destinations and landmarks (e.g. the Eiffel Tower, the
Colosseum in Rome). The existing zoom command (Groq + worldwide Nominatim search) must find
them. Landmarks take precedence over hotels and similar POIs (a hotel named "Hotel Eiffel" must
not beat the Eiffel Tower itself). Keep the change and the spec small.

User feedback (2026-11-10): a hotel must not be excluded altogether. If the user asks for a
hotel (e.g. "Hotel Eiffel Paris"), they want that hotel, not the tower. Landmark precedence
applies only to ambiguous queries where no hotel is mentioned (e.g. "Eiffel", "Koloseum").

## Goal

Users can zoom to well-known landmarks and attractions, not only to towns, regions and
natural features. An ambiguous query lands on the landmark rather than on a similarly named
business, while an explicit request for a hotel or similar POI still finds it.

## Scope

### In scope

- Landmarks, monuments, castles, museums, viewpoints and similar tourist attractions as valid
  results of the existing zoom command, worldwide (spec 005 keeps the worldwide search).
- Hotels and similar POIs accepted when the query clearly aims at them.
- Ranking so that for ambiguous queries landmarks beat hotels and similar POIs.
- Example hints and README wording that mention landmarks, in both languages.

### Out of scope

- Any new command, map layer, marker, popup, photo or description of the landmark.
- Search suggestions or autocomplete.
- Changes to the cooldown, rate limit, daily cap, validation and messages of spec 005.

## User stories

- As a user, I want to type "Zoom to Eiffel Tower" or "Přibliž na Koloseum" so that the map
  shows that landmark.
- As a user, I want "Eiffel" alone to show the tower and not a hotel with that word in its name.
- As a user, I want "Hotel Eiffel Paris" to show that hotel and not the tower.

## Functional requirements

- FR-1: Landmarks and tourist attractions (monuments, castles, museums, viewpoints, historic
  sites and similar) count as places for the zoom command, in addition to the kinds already
  accepted in spec 005 FR-14.
- FR-2: Hotels, hostels, restaurants, shops, offices and similar POIs ("POIs") are accepted as
  a result when the query aims at them (FR-3). Information boards and similar non-destinations
  stay excluded.
- FR-3: A query aims at a POI when it names the kind of POI (e.g. "hotel", "hostel", "penzion",
  "restaurant", "restaurace", in Czech or English, with or without diacritics), or when no
  landmark or ordinary place was found for it and a POI is the best match. In that case the POI
  is returned and is never replaced by a landmark.
- FR-4: For any other query (no POI kind named) that matches both a landmark and a POI, the
  landmark wins, regardless of the order in which the geocoder lists them. If nothing at all
  matches, the existing "place not found" result (spec 005 FR-10) is kept.
- FR-5: The Czech and English names of a landmark work ("Koloseum" / "Colosseum", "Eiffelova
  věž" / "Eiffel Tower"), with or without diacritics.
- FR-6: The map zooms to a landmark or POI closely enough to show it (not a whole city), within
  the map's zoom range and valid coordinates (spec 005 FR-2, FR-8).
- FR-7: The rotating example hints (spec 005 FR-16) include at least one landmark example,
  e.g. "Zoom to the Colosseum" / "Přibliž na Koloseum".
- FR-8: The README states that landmarks can be searched.
- FR-9: The change adds no extra geocoder request per command (at most one request, within the
  geocoder's usage rules and the existing 1 request/s spacing) and keeps caching.

## Non-functional requirements

- NFR-1 Cost: no new service or paid plan; the existing geocoder and its usage rules stay
  respected (spec 005 NFR-1, FR-14).
- NFR-2 Localisation: every new user-visible text (hints, README wording) exists in CZ and EN.
- NFR-3 Browsers: latest Chrome, Firefox, Safari, Edge.
- NFR-4 Testability: ranking is covered by automated tests with simulated geocoder answers,
  without a real geocoder call.

## Acceptance criteria

- [ ] AC-1: "Zoom to Eiffel Tower" and "Přibliž na Eiffelovu věž" move the map to the tower in
  Paris, not to a hotel or shop. (FR-1, FR-4, FR-5, FR-6)
- [ ] AC-2: "Zoom to Colosseum" and "Přibliž na Koloseum" move the map to the Colosseum in
  Rome. (FR-1, FR-5, FR-6)
- [ ] AC-3: With simulated answers listing "Hotel Eiffel" before the Eiffel Tower, the query
  "Eiffel" returns the tower. (FR-4)
- [ ] AC-4: With the same simulated answers, "Hotel Eiffel Paris" and "Přibliž na hotel Eiffel"
  return the hotel, not the tower. (FR-2, FR-3)
- [ ] AC-5: With simulated answers containing only a hotel/restaurant/shop, any such query
  returns that POI; with no answers, or only information boards, the result is "place not
  found" and the map is unchanged. (FR-2, FR-3, FR-4)
- [ ] AC-6: With simulated answers containing a town and a hotel of the same name, the query
  "Vienna" returns the town as before. (FR-4)
- [ ] AC-7: The view after zooming to a landmark or hotel is close enough to see it, and lies
  within valid coordinates and the zoom range. (FR-6)
- [ ] AC-8: With an empty input the hints include a landmark example in both languages.
  (FR-7, NFR-2)
- [ ] AC-9: README mentions landmark search.
  (FR-8)
- [ ] AC-10: One command causes at most one geocoder request; repeating it is served from the
  cache. (FR-9)
- [ ] AC-11: Existing spec 005 behavior ("Zoom to Brno", "Zoom to Vienna" giving Vienna,
  Austria) is unchanged. (FR-4)
- [ ] AC-12: Ranking tests (AC-3 to AC-6) run without a real geocoder call. (NFR-4)

## Assumptions

- Current code accepts only boundary, place, natural, waterway, landuse and highway results
  (`src/server/geocoding/nominatimGeocoder.ts`), so landmarks and hotels are today filtered
  out as "not a place"; this is the cause being fixed.
- "Landmark" is judged by the geocoder's own classification of objects; no own list of
  landmarks is maintained.
- Hotel intent is recognised from the query text (POI-kind word, FR-3) or from the absence of
  any landmark or ordinary place. The exact word list is chosen by the developer. This also
  means an unusual query matching only some shop returns that shop instead of "not found".
- When a query matches both a landmark and an ordinary place (e.g. a town with a famous
  monument of the same name), the geocoder's own order between those two is kept.
- The search stays worldwide; Czech landmarks get no preference (spec 005).
- Zoom level for landmarks and POIs is chosen by the developer.
- Spec 005 is not edited. This spec **supersedes** the sentence in spec 005 FR-14 "Only places
  count as a result, not hotels, offices or boards with a similar name" and AC-1's implied
  exclusion: hotels and similar POIs now count when the query aims at them (FR-2, FR-3) or
  when nothing better exists. For queries that do not aim at a POI, 005 still holds in
  practice (a hotel never beats a place or landmark).
- The version is bumped by the developer according to the project's versioning policy.

## Open questions / risks

- Risk: geocoder classification of famous sites is inconsistent (some are tagged as
  attractions, some as historic or man-made objects); a few landmarks may still not be found.
- Risk: large sites (e.g. a castle complex) may zoom to a single building; acceptable.
- Risk: the keyword rule can misfire (e.g. a landmark with "hotel" in its name); accepted.
- Suggestion: after this change, check the 8 hint examples still resolve correctly.
