# 004 – Transitions for the input and language switch

- **Status:** Draft
- **Date:** 2026-11-04
- **Next agent:** developer

## Original request

> Nové zadání pro GeoGrind (větev feature/user-input-and-language-switch, navazuje na spec 003).
>
> 1. Jednoduchá animace (CSS transition) při střídání rotujících placeholderů v textovém poli.
>    Přístupnost musí zůstat zachovaná: placeholder se dál nehlásí čtečkám obrazovky při rotaci,
>    funguje prefers-reduced-motion (bez animace), kontrast se nezhorší.
> 2. Transition na ohraničení textového pole při focusu (zachovat viditelný focus, kontrast a
>    ovládání klávesnicí podle AC-14/AC-15 ze specu 003).
> 3. Transition při přepínání jazyka v přepínači CZ/EN (radio group), opět s ohledem na
>    prefers-reduced-motion a přístupnost.
> 4. Tooltipy k ovládacím prvkům, ke kterým se to hodí (minimálně k volbám přepínače CZ/EN;
>    zvaž i zoom tlačítka a textové pole a rozhodni, co patří do rozsahu). Tooltipy jsou
>    dvojjazyčné (CS/EN přes i18n), přístupné z klávesnice i dotykem, nesmí zakrývat ovládání a
>    nesmí zhoršit ostatní požadavky (např. kontrast, překrývání s atribucí vlevo nahoře a
>    zoomem).
>
> Do specu zapiš výslovně předpoklady (délka a typ přechodů, kdy se tooltip zobrazí a skryje,
> chování na dotykových zařízeních) a rizika.

(English: "1. A simple animation (CSS transition) when the rotating placeholders in the text field
change. Accessibility must be kept: the placeholder is still not announced to screen readers on
rotation, prefers-reduced-motion works (no animation), contrast does not get worse. 2. A
transition on the text field's border on focus (keep the visible focus, contrast and keyboard
operation per AC-14/AC-15 of spec 003). 3. A transition when switching language in the CZ/EN
switch (radio group), again respecting prefers-reduced-motion and accessibility. 4. Tooltips on
controls where it fits (at least the CZ/EN options; consider the zoom buttons and the text field
and decide what is in scope). Tooltips are bilingual (CS/EN via i18n), reachable by keyboard and
touch, must not cover controls and must not worsen other requirements (e.g. contrast, overlap
with the attribution at top left and the zoom). State assumptions (length and type of
transitions, when a tooltip shows and hides, touch behaviour) and risks explicitly.")

**Note: items 1 (placeholder animation) and 4 (tooltips) have been deferred.** The original text
above is kept unchanged for traceability. Only items 2 and 3 are specified below.

## Decisions

- Tooltips deferred. User decision: "tooltips deferred as too complex".
- Placeholder transition dropped. User decision: placeholder transition dropped, overlay approach
  rejected as too complex (a native placeholder cannot be animated with a CSS transition, and
  replacing it with an overlay on the input is not wanted). The placeholder stays exactly as it
  is now.

No clarifying questions were needed.

## Goal

Make the existing input and language switch feel more polished with short, subtle transitions,
without weakening accessibility, contrast or layout rules from specs 002 and 003.

## Scope

### In scope

- A transition on the text input's border/focus indication (FR-1).
- A transition of the selected state in the CZ/EN switch (FR-2).
- Respecting the reduced-motion preference for both (FR-3).
- Confirming that the placeholder behaviour from spec 003 is unchanged (FR-4).

### Out of scope

- Future (deferred on purpose, to be specified later in a separate spec):
  - Animation of the rotating placeholder (deferred as too complex; overlay approach rejected).
  - Tooltips on any control (language options, zoom buttons, text input, attribution).
  - Bilingual (Czech/English) names of the zoom buttons. They stay as in spec 003.
- Any change to how the placeholder is shown, rotated or hidden (spec 003 stays as is).
- Any other animation: map movement, attribution expand/collapse, failure message.
- New controls, new commands, any handling of typed text (spec 003 stays valid).
- Changing sizes, positions, colours or wording of existing controls beyond what is needed for
  the transitions.

## User stories

- As a visitor, I want a clear but gentle visual response when the input gets focus and when I
  change language so that the interface feels responsive.
- As a visitor with a reduced-motion preference, I want no animated transitions so that the UI
  is comfortable for me.

## Functional requirements

- FR-1: When the input gains or loses focus, its border and focus indication change with a
  short transition instead of instantly. The focus indication is fully visible (spec 003,
  NFR-3) at the end of the transition.
- FR-2: When the active language changes, the selected-state styling of the switch options
  (background and text colour) changes with a short transition. Selecting the already active
  language still does nothing visible (spec 003, FR-10).
- FR-3: When the user's system requests reduced motion, FR-1 and FR-2 use no animated
  transitions: the end state appears immediately. All states and texts remain the same.
- FR-4: The rotating placeholder is unchanged by this spec: it behaves exactly as defined in
  spec 003 (FR-3, FR-5, FR-9, FR-11), with no animation and no change in how it is shown.

## Non-functional requirements

- NFR-1 (cost): No paid library, service or licence is needed (spec 003, NFR-1 applies).
- NFR-2 (localisation): This spec adds no new user-visible text. All existing texts stay
  available in Czech and English as in spec 003.
- NFR-3 (accessibility): Spec 003, NFR-3 still holds. Keyboard operation and tab order are
  unchanged. Text contrast is not lowered. The focus indicator is never absent or weaker in its
  end state than before this spec.
- NFR-4 (motion): Each transition is short and does not flash.
- NFR-5 (responsiveness): Spec 003, NFR-4 still holds: no new overlaps and no scrollbars at
  320 px, 768 px and 1920 px, in portrait and landscape.
- NFR-6 (browsers): Works in the latest Chrome, Firefox, Safari and Edge.
- NFR-7 (performance): Transitions do not recreate the map and do not affect map pan/zoom
  smoothness. Spec 003, NFR-6 still holds.

## Acceptance criteria

- [ ] AC-1: Given the input, when it is focused by mouse, touch or Tab and later blurred, then
  the border and focus indication change smoothly; once finished, the focus indicator is
  visible with the same size and contrast as before this spec (spec 003, AC-14, AC-15). (FR-1)
- [ ] AC-2: Given keyboard only, when the user presses Tab repeatedly, then focus reaches the
  same controls in the same order as before this spec, each with a visible focus indicator
  immediately recognisable even during the transition. (FR-1, NFR-3)
- [ ] AC-3: Given the page is in Czech, when the user selects "EN", then the selected-state
  styling moves from "CZ" to "EN" with a short transition; the selected state is clear at the
  end with at least 3:1 contrast. The reverse switch behaves the same. Selecting the already
  active language shows no change. (FR-2)
- [ ] AC-4: Given the operating system requests reduced motion, when the input is focused and
  blurred and the language is switched, then every change happens without an animated
  transition (border, selected state), and all texts and states are identical to the
  non-reduced case. (FR-3)
- [ ] AC-5: Given an empty input, when the placeholder is observed, rotated, hidden by typing
  and restored by deleting the text, then it behaves unchanged from spec 003: it cycles in the
  specified order and interval without animation (spec 003, AC-3), disappears on typing and
  returns with rotation on emptying (spec 003, AC-4), and is shown in the new language after a
  language switch with no mix of languages (spec 003, AC-8). (FR-4)
- [ ] AC-6: Given a screen reader and an empty input, when the placeholder rotates, then
  nothing is announced on any change, and the input's accessible name is still
  "Příkaz pro mapu" / "Map command" (spec 003, AC-16). (FR-4, NFR-3)
- [ ] AC-7: Given the changes, then no tooltip is added to any control, the zoom button names
  are unchanged from spec 003, and no placeholder animation or overlay is present. (Scope
  decision)
- [ ] AC-8: Given 320 px, 768 px and 1920 px widths, in portrait and landscape, when the
  transitions run, then there are no new overlaps and no scrollbars. (NFR-5)
- [ ] AC-9: Given the transitions, when the user pans and zooms the map and switches language,
  then the map is neither reloaded nor does it lose its view or become unresponsive. (NFR-7)
- [ ] AC-10: Given the latest Chrome, Firefox, Safari and Edge, then AC-1 to AC-9 pass in
  each. (NFR-6)
- [ ] AC-11: Given the changes, then no paid service or licence is needed to build, run or host
  them. (NFR-1)

## Assumptions

- Tooltips, bilingual zoom button names and placeholder animation were part of the original
  request and are deferred by user decision (see *Decisions*). They are not specified here.
- Transition types and durations (to be fine-tuned by the developer within these bounds):
  - Input border/focus: colour (and ring) transition of about 150 ms, ease-out. The focus
    indicator keeps the size and colour defined by spec 003; only the way it appears changes.
  - Language switch: background and text colour transition of about 150 ms. No sliding
    indicator is required.
- Reduced motion means the system/browser "prefers reduced motion" setting. With it, durations
  are effectively zero; nothing else changes (FR-3).
- The placeholder remains the browser's native placeholder, and its rotation stays without
  animation, as in spec 003.
- Czech Republic scope: all texts are generic UI texts, and there is no geographic behaviour, so
  requests outside the Czech Republic do not apply. Spec 003's assumptions on this stay valid.
- Specs 002 and 003 are not edited. This spec refines their controls and removes none of their
  requirements.

## Open questions / risks

- Risk: a transition on the focus ring can briefly show a weaker indicator. AC-1 and AC-2
  require that the end state is the same as before; keep the duration short.
- Suggestion: when tooltips are picked up again, specify them in a separate spec together with
  localised zoom button names (possibly via the map library's own locale support, which would
  also cover other control texts such as the attribution toggle).
- Suggestion: placeholder animation can be revisited later in a separate spec if a simple
  approach is found; it is not planned now.
- Suggestion: if the text input should later get a "coming soon" note (suggested in spec 003),
  do it in a spec that also defines the command behaviour.
