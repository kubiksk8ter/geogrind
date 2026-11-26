# 004 – Transitions for the input and language switch (design)

- **Status:** Draft
- **Date:** 2026-11-04
- **Spec:** [004 – Transitions for the input and language switch](../specs/004-motion-transitions.md)
- **Next agent:** developer

## Summary

Pure CSS, no new dependency, no new user-visible text. The input's border/outline colour and the
language switch's selected colours get short `transition` classes. Every transition carries
`motion-reduce:transition-none`, defined once in `sharedConstants.ts`. The placeholder stays the
native attribute with the existing rotation (spec 003); it is not touched.

## Decisions

### D-1: Focus transition on the input (FR-1, AC-1, AC-2)

- **Choice:** `transition-[border-color,outline-color]`, `ease-out`, on the `<input>`.
  Border goes from `neutral-500` to `blue-600` on focus. Only *colour* is animated, in both
  directions. The ring is always present (`outline-3 outline-solid outline-transparent`), so
  its geometry never changes and only its colour fades; in forced-colors mode it is switched
  off when not focused (`forced-colors:not-focus-visible:outline-0`). End state is the same
  size and colour as `FOCUS_RING_CLASS_NAME` (AC-1).
- **Durations (decided by the user after implementation):** 700 ms on focus
  (`focus-visible:duration-700`) and 300 ms on blur (`duration-300`), so the fade back is
  faster. Originally the design said ~150 ms.
- **Alternatives considered:** `transition-all` (animates width/shadow, can make the ring look
  smaller during the transition, and animates unrelated properties); animating `box-shadow`
  rings (changes the focus indicator definition from spec 003). Rejected.
- **Rationale:** The border stays visible throughout and the ring geometry is constant, so focus
  is recognisable during the transition (AC-2, spec risk). The developer checks the first frames
  in all four browsers; if the ring feels too weak, drop the delayed ring colour and animate only
  the border colour.

### D-2: Selected-state transition in the language switch (FR-2, AC-3)

- **Choice:** `transition-[background-color,color]`, `ease-out`, on `Radio.Root`
  (styled by `data-checked`, unchanged). Both options transition at once: the old one to
  white/dark text, the new one to dark/white text. No sliding indicator. Outline colour is
  intentionally *not* transitioned, so the focus ring on the switch stays immediate (AC-2).
  Re-selecting the active language changes no state, hence nothing animates (FR-2).
- **Duration (decided by the user after implementation):** `duration-300` (originally ~150 ms).
- **Alternatives considered:** Base UI `Radio.Indicator` or a sliding highlight – more markup
  and the spec says none is required.

### D-3: One shared definition of "reduced motion" (FR-3, AC-4)

- **Choice:** Add `TRANSITION_CLASS_NAME` to `src/components/sharedConstants.ts`:
  `"ease-out motion-reduce:transition-none"`. Both transitions include it; each adds its own
  `transition-[...]` property list and duration (durations are local, not in the constant;
  see D-1, D-2). Tailwind 4's `motion-reduce:` variant is
  the `prefers-reduced-motion: reduce` media query, so no JS and no hook are needed.
- **Alternatives considered:** A global `@media (prefers-reduced-motion)` rule in `globals.css`
  that zeroes durations – also works but hides the behaviour from the components and affects
  MapLibre controls; a `useReducedMotion` hook – JS for a pure CSS concern.
- **Rationale:** Matches how `sharedConstants.ts` is used (a class set shared by several
  components). No `cn` function. The constant must stay a complete literal string so Tailwind
  detects its classes.

## Dependencies

None added (NFR-1, AC-11). Tailwind 4 and Base UI are already installed. No `@types/*`.

## Components

| Component | Responsibility | Folder |
|---|---|---|
| CommandInput (changed) | Border/outline colour transition on the `<input>` | `src/components/command-input/` |
| LanguageSwitch (changed) | Colour transition on `Radio.Root` | `src/components/language-switch/` |
| Shared constants (changed) | `TRANSITION_CLASS_NAME` | `src/components/` |

Messages, i18n, map, engine and the placeholder rotation hook are untouched.

## Data flow

1. Focus/blur of the input and radio selection are CSS-only: the browser transitions the
   properties named above when the state changes (`:focus-visible`, `data-checked`).
2. Reduced motion: `motion-reduce:transition-none` → the change happens instantly.
3. Placeholder rotation and language-dependent hint texts work exactly as in design 003.

## Interfaces

No new boundaries or types. One shared constant:

```ts
// src/components/sharedConstants.ts
export const TRANSITION_CLASS_NAME: string; // "ease-out motion-reduce:transition-none"
```

## External services

None (NFR-1).

## Error handling

- No external calls. A browser without `prefers-reduced-motion` support does not exist in the
  supported set; if the media query never matches, the user gets the short transitions.
- Transitions that never run (hidden tab, throttled timers): the end state is applied by CSS
  anyway; nothing depends on `transitionend`.

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1 / AC-1, AC-2 | D-1; T-1; manual (focus by mouse, touch, Tab; four browsers) |
| FR-2 / AC-3 | D-2; T-2 |
| FR-3 / AC-4 | D-3; T-1, T-2, T-3; manual with the OS setting |
| FR-4 / AC-5, AC-6 | Nothing changes; existing placeholder tests (T-3); manual screen reader |
| AC-7 (no tooltips, no overlay, zoom names unchanged) | Nothing is added; T-3 review |
| NFR-1 / AC-11 | No dependencies |
| NFR-2 | No new texts; existing messages parity test |
| NFR-3 | D-1 (constant ring geometry, same end state), D-2 (focus ring immediate) |
| NFR-4 | D-1/D-2 (colour only; durations per the user's decision in D-1, D-2) |
| NFR-5 / AC-8 | Colour-only transitions change no size; manual at 320/768/1920 px |
| NFR-6 / AC-10 | Manual in four browsers |
| NFR-7 / AC-9 | CSS only, no engine or map change; manual pan/zoom + switch |

## Implementation plan

1. **T-1: Shared constant and input focus transition** – add `TRANSITION_CLASS_NAME`; add the
   transition classes to the `<input>`. Done when: border/ring colour animates (D-1 durations), end state
   identical to before, no animation with reduced motion. Covers: FR-1, FR-3, AC-1, AC-2, AC-4.
2. **T-2: Language switch transition** – transition classes on `Radio.Root`. Done when: CZ/EN
   colours animate (D-2 duration), end states identical to before, focus ring immediate, no animation
   with reduced motion. Covers: FR-2, FR-3, AC-3, AC-4.
3. **T-3: Tests and checks** – tests below, manual checks, lint, typecheck, build. Confirm no
   tooltip or overlay was added and the placeholder is unchanged. Done when: `npm test`, lint,
   typecheck, build green. Covers: FR-4, AC-5–11.

## Testing

Vitest (jsdom does not run transitions, so visuals are manual):

- Existing `CommandInput` placeholder tests stay unchanged and green (order, loop, pause while
  typing, language switch; AC-5); the `placeholder` attribute is still present and the accessible
  name is unchanged in both languages (AC-6).
- Class check: the input and `Radio.Root` include `motion-reduce:transition-none` (cheap guard
  for FR-3 regressions).

Manual: AC-1/2 in four browsers incl. touch and Tab order; AC-3 colours and 3:1 contrast; AC-4
with the OS setting on; AC-6 with a screen reader (NVDA/VoiceOver); AC-8 at 320/768/1920 px both
orientations; AC-9 pan/zoom while switching.

## Risks / open questions

- Ring colour fade could look weak in the first frames (D-1 fallback described).
- Forced-colors mode: the outline is switched off when not focused and drawn with the system
  colour when focused; the colour fade has no visible effect there. Acceptable.

## Out of scope

- Animation of the rotating placeholder is deferred (spec 004 *Decisions*); the native
  placeholder stays as in design 003. Tooltips are deferred as well.
