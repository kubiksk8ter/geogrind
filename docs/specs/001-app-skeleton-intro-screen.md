# 001 – Application skeleton with intro screen

- **Status:** Draft
- **Date:** 2026-11-01
- **Next agent:** architect

## Original request

> Vytvoř úvodní verzi aplikace (kostru), pouze s úvodní obrazovkou s textem "GeoGrind".

(English: "Create the initial version of the application (a skeleton), with only an intro screen
showing the text "GeoGrind".")

No clarifying questions were needed.

## Goal

Create the first runnable version of GeoGrind: an empty application foundation with a single
intro screen showing the product name. It gives later features (map, natural-language input)
a working base to build on.

## Scope

### In scope

- A runnable application that opens on a single intro screen.
- The intro screen shows the text "GeoGrind" as its main heading.
- The application is ready for Czech and English from the start (see NFR-2).

### Out of scope

- The map and any map layers.
- The natural-language input and command handling.
- A user-facing language switcher (see *Open questions / risks*).
- Any other screens, navigation, authentication or data storage.
- Visual branding beyond the text (logo, colour scheme, animations).

## User stories

- As a visitor, I want to see the GeoGrind name when I open the app so that I know I am in the
  right place.
- As a member of the development team, I want a working application skeleton so that later
  features can be added to it.

## Functional requirements

- FR-1: Each language has its own address (`/cs`, `/en`) that shows the intro screen. Opening
  the root address redirects to one of them (Czech unless the user's preference is English).
- FR-2: The intro screen shows the text "GeoGrind" as the main (top-level) heading of the page.
- FR-3: The text "GeoGrind" is a product name and is shown identically in Czech and English.
- FR-4: The browser tab title of the intro screen contains "GeoGrind".
- FR-5: The intro screen shows no other functional elements (no map, no input).

## Non-functional requirements

- NFR-1 (cost): The skeleton uses no paid external services; any service used (e.g. hosting)
  must be free of charge, free tiers included.
- NFR-2 (localisation): The application supports Czech and English. Every user-visible text
  other than the product name must be available in both languages. The page declares the
  language it is currently displayed in.
- NFR-3 (accessibility): The heading is exposed to assistive technologies as the page's main
  heading and meets WCAG 2.1 AA contrast requirements.
- NFR-4 (responsiveness): The intro screen is readable without horizontal scrolling on screen
  widths from 320 px up to desktop sizes.
- NFR-5 (browsers): Works in the latest version of Chrome, Firefox, Safari and Edge. Older
  versions are not supported.

## Acceptance criteria

- [ ] AC-1: Given the application is running, when a user opens `/cs` or `/en`, then the intro
  screen is displayed without errors; when a user opens the root address, then they are
  redirected to `/cs` (or `/en` if their preference is English) and see the intro screen. (FR-1)
- [ ] AC-2: Given the intro screen is displayed, then the text "GeoGrind" is visible and is the
  page's top-level heading. (FR-2, NFR-3)
- [ ] AC-3: Given the application is displayed in Czech, and given it is displayed in English,
  then in both cases the heading reads exactly "GeoGrind". (FR-3, NFR-2)
- [ ] AC-4: Given the intro screen is open, then the browser tab title contains "GeoGrind".
  (FR-4)
- [ ] AC-5: Given the intro screen is displayed, then no map, text input or other interactive
  element is present. (FR-5)
- [ ] AC-6: Given the application is displayed in either language, then the page declares the
  matching language (Czech or English). (NFR-2)
- [ ] AC-7: Given a screen width of 320 px, when the intro screen is displayed, then the
  heading is fully visible without horizontal scrolling. (NFR-4)
- [ ] AC-8: Given the heading and its background, then their contrast ratio is at least 4.5:1.
  (NFR-3)
- [ ] AC-9: Given the skeleton, then it requires no paid service to build, run or host. (NFR-1)

## Assumptions

- The product name "GeoGrind" is never translated.
- Czech is the default language when no other preference is known.
- The heading is centred on the screen; exact typography is left to implementation.
- Czech Republic scope: the skeleton has no geographic functionality, so requests outside the
  Czech Republic are not applicable yet. Later specs define that behaviour.
- The skeleton follows the stack named in the README (TypeScript, Next.js, Vitest, i18n
  library); the architect decides the project structure.

## Open questions / risks

- Suggestion: add a Czech/English language switcher in a follow-up spec, so users can actually
  choose the language as required by the product constraints.
- Suggestion: a short tagline under the heading (in both languages) could explain what the app
  does; not requested, so not included.
