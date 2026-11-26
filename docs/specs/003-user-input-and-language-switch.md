# 003 – Command input field and CZ/EN language switch

- **Status:** Draft
- **Date:** 2026-11-02
- **Next agent:** architect

## Original request

> Nové zadání pro GeoGrind (větev feature/user-input-and-language-switch):
>
> 1. Textové pole dole uprostřed mapy s rotujícím placeholderem, který napovídá, co uživatel
>    může psát. Zatím bez funkcionality (jen UI).
> 2. Přepínač CZ/EN umístěný hned vedle tlačítek pro zoom mapy. Přepínání jazyka musí být už
>    funkční (UI texty včetně rotujících placeholderů se mají přepnout).
> 3. Architekt má vybrat UI knihovnu vhodnou pro budoucí boční panel (záložky, graf měsíčního
>    využití s časem resetu tokenů, přepínání vrstev). Do specifikace uveď toto jako požadavek
>    na architekta (doporuč architekta jako další krok).

(English: "1. A text field at the bottom centre of the map with a rotating placeholder hinting at
what the user can type. No functionality yet (UI only). 2. A CZ/EN switch placed right next to
the map's zoom buttons. Switching language must already work (UI texts, including the rotating
placeholders, switch). 3. The architect is to choose a UI library suitable for a future side
panel (tabs, a monthly-usage chart with the token reset time, layer toggling). State this in the
spec as a requirement for the architect and recommend the architect as the next step.")

No clarifying questions were needed.

### User decisions after the architect's review

The architect raised two points in the design risks. The user decided:

1. The CZ/EN switch may be placed directly **below** the zoom buttons instead of beside them. The
   map stacks controls in a corner vertically and this suits the user. The switch stays in the
   same corner as the zoom buttons. This overrides "right next to" from the request above.
2. The built-in zoom buttons are **not enlarged**. The user considers them big enough (about
   29 px). The 44 px touch-target requirement (NFR-7) therefore does not apply to them.

### User decisions after the implementation review

After reviewing the implementation, the user made two further decisions. They refine the
decisions above and the original request:

3. The CZ/EN switch has the **same size as the map's built-in zoom buttons** (about 29 px), not
   44 px. This extends decision 2: the 44 px touch-target requirement (NFR-7) now does not apply
   to the switch options either. It remains only for the text input.
4. The map's collapsible attribution moves to the **top-left corner**. The text input at the
   bottom centre moves **lower, closer to the bottom edge**, because on mobile it reached too far
   into the middle of the map. With the attribution no longer at the bottom, it no longer
   collides with the input.

## Goal

Add the first user-facing controls on top of the map: a command input field that shows what kind
of commands the app will understand, and a working Czech/English switch, so that users can choose
their language. In addition, prepare the UI foundation for a future side panel.

## Scope

### In scope

- A text input at the bottom centre of the map, close to the bottom edge, with rotating
  placeholder hints (UI only).
- A CZ/EN language switch in the same corner as the map's zoom buttons, directly below them,
  with options the same size as the zoom buttons, fully functional.
- Moving the map's collapsible attribution to the top-left corner (FR-15).
- Czech and English versions of all texts added by this spec, including every placeholder.
- A decision by the architect on the UI component library for the future side panel (FR-14).

### Out of scope

- Any handling of what the user types: no command parsing, no map reaction, no AI/LLM call,
  no submit action, no history or suggestions.
- The side panel itself (tabs, usage chart, token reset time, layer toggles); only the library
  decision is in scope.
- The header with the visible "GeoGrind" name (postponed; spec 002 keeps the heading hidden).
- Languages other than Czech and English.
- Changes to map behaviour, style or initial view (spec 002).
- Enlarging or restyling the map's built-in zoom buttons (user decision).
- Making the language switch larger than the zoom buttons (user decision).
- Changing the content or wording of the attribution; only its position changes.

## User stories

- As a visitor, I want a text field on the map with example hints so that I understand I can
  control the map by typing and what I can ask for.
- As a visitor, I want the text field close to the bottom edge so that it does not cover the
  middle of the map, especially on a phone.
- As a visitor, I want to switch between Czech and English right below the zoom buttons so that
  I can use the app in the language I prefer.
- As a visitor, I want the hints to appear in the language I chose so that the examples are
  understandable to me.
- As a visitor, I want the map attribution out of the way of the text field so that both stay
  readable and usable.
- As a member of the development team, I want the UI library for the future side panel chosen
  early so that the panel and existing controls share one consistent foundation.

## Functional requirements

- FR-1: While the map is displayed, a single-line text input is shown at the bottom centre of
  the viewport, on top of the map. It is horizontally centred in the viewport and placed close
  to the bottom edge, separated from it only by a small gap (also on devices with a bottom
  safe area), so that it covers as little of the central part of the map as possible, notably on
  a phone. This position supersedes the earlier, higher placement (user decision 4).
- FR-2: The user can click or tab into the input, type text, and edit or delete it. Pressing
  Enter (or the mobile keyboard's submit key) does nothing: no action, no message, no change of
  the map, and the typed text stays.
- FR-3: While the input is empty, it shows a placeholder hint. The hint changes automatically to
  the next one in a fixed list at regular intervals, in a loop, so that all hints are shown in
  turn.
- FR-4: The placeholders are example commands the app is meant to support, written as natural
  commands about the Czech Republic. The initial list, in order, is:
  1. cs "Přibliž na Prahu" / en "Zoom to Prague"
  2. cs "Zobraz cyklostezky" / en "Show cycling routes"
  3. cs "Ukaž Brno" / en "Show Brno"
  
  The final wording and any extra entries may be refined in review, provided both languages
  keep the same meaning and order.
- FR-5: Rotation of the placeholder stops while the user is typing (the input is not empty) and
  the placeholder is not visible then. When the input becomes empty again, the placeholder is
  shown again and rotation resumes.
- FR-6: A language switch showing the two options "CZ" and "EN" is placed in the same corner of
  the map as the zoom buttons, directly below them, as one visually grouped, vertically stacked
  set of map controls, in all viewport sizes. This placement (below, not beside) is a user
  decision. Each option has the same size as a zoom button (about 29 px), so the switch and the
  zoom buttons form a uniform column (user decision 3). The currently active language is clearly
  marked as selected.
- FR-7: Selecting the other language switches the whole UI immediately to that language: the
  accessible map name (spec 002, FR-8), the input's accessible label and all placeholders. The
  page's address changes to the matching language address (`/cs` or `/en`, spec 001, FR-1), and
  the page declares the new language.
- FR-8: After a language switch, the map keeps its current view (position and zoom), and text
  already typed in the input is kept.
- FR-9: After a language switch, the placeholder list restarts or continues in the new language
  with the same entry position; the entries are never mixed from both languages at once.
- FR-10: Selecting the already active language does nothing visible.
- FR-11: The input has an accessible name in the current language: "Příkaz pro mapu" (Czech) /
  "Map command" (English). The rotating placeholder is not the only means of naming it.
- FR-12: The language switch options have accessible names in the current language: "Čeština" /
  "Czech" and "Angličtina" / "English" for the options, and the group is named "Jazyk" /
  "Language". The visible labels "CZ" and "EN" are the same in both languages.
- FR-13: When the map cannot be loaded (spec 002, FR-11), the failure message is shown as
  before; the input and the language switch are not shown in that state.
- FR-14: The architect chooses the UI component library (or decides on a library-free approach
  with accessible primitives) for the future side panel and records the decision with its
  rationale. The choice must fit these planned panel needs:
  - tabs;
  - a chart of monthly usage, including the time at which tokens reset;
  - toggling of map layers.

  The decision must consider cost (NFR-1), accessibility (NFR-3), the existing Tailwind CSS
  styling, bilingual UI (NFR-2) and bundle size. The input and the language switch built in
  this spec must follow the chosen approach.
- FR-15: The map's collapsible attribution is shown in the top-left corner of the viewport,
  on top of the map, instead of at the bottom. It keeps its collapsible behaviour: the user can
  expand it to read the full attribution text and collapse it again. The attribution required
  by the map data/tile provider's licence stays visible on the map at all times, at least in its
  compact (collapsed) form, and its text is unchanged. This changes the placement relative to
  spec 002 (see *Assumptions*); the requirement of spec 002, FR-9 remains fully met.

## Non-functional requirements

- NFR-1 (cost): All libraries and services chosen (including the UI library from FR-14) are
  free of charge; no paid plan or licence tier may be required.
- NFR-2 (localisation): Every user-visible and assistive text added by this spec exists in
  Czech and English, including each placeholder, the input label and the switch labels. The
  product name stays "GeoGrind". The visible options "CZ" and "EN" are identical in both
  languages. The attribution text is exempt (spec 002, user decision on attribution language).
- NFR-3 (accessibility): Both controls are fully operable by keyboard with a visible focus
  indicator. Text and controls meet WCAG 2.1 AA contrast (at least 4.5:1 for text, 3:1 for
  control boundaries and the selected state). The placeholder text must not be announced
  repeatedly by screen readers on each rotation. Users with a reduced-motion preference see
  no animated transition between hints. The attribution in its new position remains operable
  by keyboard and readable at the same contrast levels.
- NFR-4 (responsiveness): At viewport widths from 320 px to large desktop sizes, in portrait and
  landscape, the input and the switch are fully visible, do not overlap each other, the zoom
  buttons or the map attribution, and cause no scrollbars. The attribution, also when expanded,
  stays within the viewport and does not overlap the zoom buttons or the switch. The input has
  a comfortable width on desktop and uses most of the available width on narrow screens. The
  hints are not cut off at 320 px.
- NFR-5 (browsers): Works in the latest version of Chrome, Firefox, Safari and Edge. Older
  versions are not supported.
- NFR-6 (performance): Switching language and rotating hints do not reload the map, and the
  map stays interactive (pan/zoom) throughout.
- NFR-7 (touch): On touch devices, the tap target of the text input is at least 44 x 44 px (or
  equivalent spacing), and focusing the input must not make the page scroll or the map shift out
  of the viewport. The map's built-in zoom buttons and the language switch options are
  explicitly exempt from the 44 px minimum: they have the same size (about 29 px) by user
  decision.

## Acceptance criteria

- [ ] AC-1: Given the map is displayed, when `/cs` or `/en` is opened, then a single-line text
  input is visible at the bottom centre of the viewport, on top of the map, horizontally
  centred and separated from the bottom edge only by a small gap (compared with the previous
  implementation it sits visibly lower), at 320 px, 768 px and 1920 px widths. (FR-1)
- [ ] AC-2: Given the input is displayed, when the user clicks it, types text, edits and deletes
  it, and presses Enter, then the text can be entered and changed, and pressing Enter causes no
  visible reaction (no map change, no message, text unchanged). (FR-2)
- [ ] AC-3: Given the input is empty and the page is in English, when the page is observed long
  enough, then the placeholder cycles through "Zoom to Prague", "Show cycling routes" and
  "Show Brno" in this order and then starts again; the same holds in Czech with "Přibliž na
  Prahu", "Zobraz cyklostezky" and "Ukaž Brno". (FR-3, FR-4, NFR-2)
- [ ] AC-4: Given the input is empty and a placeholder is shown, when the user types a
  character, then the placeholder disappears; when the user deletes all text, then a
  placeholder is shown again and rotation continues. (FR-5)
- [ ] AC-5: Given the map is displayed at 320 px, 768 px and 1920 px widths, then the switch
  with the options "CZ" and "EN" is in the same corner as the zoom buttons, directly below
  them, forming one vertically stacked group, each option is the same size as a zoom button
  (about 29 px), and the active language is visibly marked as selected. (FR-6, NFR-4)
- [ ] AC-6: Given the page is open in Czech, when the user selects "EN", then the address
  changes to `/en`, the page declares English, the accessible map name reads "Map of the Czech
  Republic", the input's accessible name reads "Map command" and the placeholders appear in
  English. The reverse switch from English to Czech works equally. (FR-7, NFR-2)
- [ ] AC-7: Given the user has panned and zoomed the map and typed text in the input, when they
  switch language, then the map view is unchanged and the typed text is still in the input.
  (FR-8, NFR-6)
- [ ] AC-8: Given the input is empty, when the language is switched, then at no moment are
  placeholders of both languages visible and the placeholder shown is in the new language.
  (FR-9)
- [ ] AC-9: Given the page is open in a language, when the user selects the already active
  language, then nothing visibly changes. (FR-10)
- [ ] AC-10: Given the page is inspected with an accessibility tool in each language, then the
  input has the accessible name "Příkaz pro mapu" / "Map command", the switch group is named
  "Jazyk" / "Language" and its options "Čeština" / "Czech" and "Angličtina" / "English".
  (FR-11, FR-12, NFR-2)
- [ ] AC-11: Given the map cannot be loaded, when `/cs` or `/en` is opened, then the failure
  message from spec 002 is shown and neither the input nor the language switch is present.
  (FR-13)
- [ ] AC-12: Given the architect's design for this spec, then it names the chosen UI library (or
  library-free approach), explains how it fits tabs, a usage chart with token reset time and
  layer toggles, and confirms it is free of charge. (FR-14, NFR-1)
- [ ] AC-13: Given the implemented input and language switch, then they are built following
  the approach chosen in FR-14. (FR-14)
- [ ] AC-14: Given a keyboard only, when the user presses Tab, then focus reaches the zoom
  buttons, the language switch and the input, each with a visible focus indicator, and the
  language can be switched with the keyboard. (NFR-3)
- [ ] AC-15: Given the controls are displayed, then text contrast is at least 4.5:1 and control
  boundaries and the selected state have at least 3:1 contrast, including text over the map.
  (NFR-3)
- [ ] AC-16: Given a screen reader and the input is empty, when the placeholder rotates, then
  the screen reader does not announce each change. Given the operating system requests reduced
  motion, then hints change without an animated transition. (NFR-3)
- [ ] AC-17: Given viewport widths of 320 px, 768 px and 1920 px, in portrait and landscape,
  then the input and the switch are fully visible, do not overlap each other, the zoom buttons
  or the attribution, no placeholder is cut off, and no scrollbar appears; and the attribution,
  both collapsed and expanded, stays within the viewport and does not overlap the zoom buttons
  or the switch. (NFR-4)
- [ ] AC-18: Given a touch device, then the tap target of the text input is at least 44 x 44 px,
  and focusing the input does not scroll the page or move the map out of the viewport. The
  map's built-in zoom buttons and the language switch options are not checked against 44 px;
  they are the same size as each other (about 29 px). (NFR-7)
- [ ] AC-19: Given the latest Chrome, Firefox, Safari and Edge, then AC-1 to AC-11, AC-14 to
  AC-18, AC-21 and AC-22 pass in each. (NFR-5)
- [ ] AC-20: Given the new controls, then no paid service or licence is needed to build, run or
  host them. (NFR-1)
- [ ] AC-21: Given the map is displayed at 320 px, 768 px and 1920 px widths, in portrait and
  landscape, then the collapsible attribution is in the top-left corner of the viewport, no
  attribution is shown at the bottom of the map, and the user can expand it to read the full
  text and collapse it again, with mouse, touch and keyboard. (FR-15, NFR-3)
- [ ] AC-22: Given the map is displayed, then the attribution required by the provider's licence
  is visible on the map (at least in its compact form) and its text is the same as before the
  move, and the text input at the bottom does not overlap or hide it. (FR-15, FR-1)

## Assumptions

- Spec 002's FR-10 ("no other UI elements") and its AC-10 are superseded by this spec for the
  input and the language switch; spec 002 itself is not edited. Its hidden "GeoGrind" heading
  stays.
- Spec 002 requires attribution (FR-9, AC-9) but does not define its position; the earlier
  implementation showed it in the map's default place at the bottom. This spec explicitly
  changes that placement to the top-left corner (FR-15). Spec 002 is not edited; its FR-9 and
  AC-9 still hold, because the attribution stays visible. Spec 002's FR-10 and AC-10 already
  allow the attribution on screen.
- The map's existing built-in zoom buttons are the "zoom buttons" meant by the request. Their
  current position and size are kept; the switch is placed in the same corner directly below
  them, so they read as one control group of uniform size. The user explicitly accepted
  "below" instead of "beside", explicitly declined enlarging the zoom buttons and explicitly
  chose the same size for the switch.
- The root address redirect (spec 001, FR-1) is unchanged. Remembering the chosen language
  for later visits follows the existing locale behaviour; no new storage is required by this
  spec.
- The placeholders are only examples of future commands. The input does not promise they work
  yet; the app must not claim that any command is processed.
- Rotation interval is about 4 seconds per hint; the exact value is left to the architect and
  developer.
- The exact gap between the input and the bottom edge is left to the developer; it is a small
  gap, not a fixed number of pixels, and it must keep the input fully visible and usable.
- Czech Republic scope: all example hints refer to places or data in the Czech Republic. The
  input has no behaviour yet, so requests outside the Czech Republic (e.g. "Zoom to Vienna")
  are not handled here; a later spec defines that (see *Open questions / risks*).
- Typed text is not limited, validated or stored; it only lives in the input.
- The input has no visible submit button, clear button or label in this spec; the accessible
  name in FR-11 is enough.
- The failure state (FR-13) shows no switch, because the message and the full-screen area
  remain exactly as defined in spec 002. Where the attribution is shown (or not) in that state
  is not changed by this spec.

## Open questions / risks

- Risk: switching language means navigating to the other language address; the map may
  reload and lose its view. FR-8 and NFR-6 require otherwise, so the architect must find a way
  that satisfies them.
- Risk: the zoom buttons are currently top-right (default map position), so "below the zoom
  buttons" also puts the switch at the top right. If the future header also uses the top right,
  the layout needs revisiting.
- Risk: the top-left corner is now taken by the attribution. The planned header may want the
  same corner (for the "GeoGrind" name), so the layout of the top edge needs revisiting when
  the header is specified.
- Risk: the built-in zoom buttons and the language switch options (about 29 px each) are below
  the 44 px touch size, so they may be harder to tap on small touch screens. This is an
  accepted user decision, not a defect.
- Risk: an expanded attribution at the top-left may be wide at 320 px and come close to the
  zoom buttons and the switch at the top right; NFR-4 requires that they do not overlap.
- Suggestion: a non-functional input may mislead users into thinking commands work. Consider a
  short "coming soon" note or a disabled look until the next spec adds command handling.
- Suggestion: in the next spec define behaviour of commands about places outside the Czech
  Republic and for unsupported commands.
- Suggestion: the future side panel may need its own spec for its layout on small screens,
  where it competes with the input at the bottom.
