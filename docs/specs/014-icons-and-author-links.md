# 014 – Application icons, panel icons and footer links

- **Status:** Draft
- **Date:** 2026-11-27 (extended 2026-11-28)
- **Next agent:** developer

## Original request

The user's request (translated from Czech; branch develop):

1. "The favicon should be a nice 'G', probably best created as SVG."
2. "I would also like to add links to GitHub and LinkedIn in a suitable place. Icons alone are
   enough, possibly with a native title attribute."

Earlier planning had also meant icons for the side panel tabs; this was put to the user.

Clarifying Q&A (translated from Czech):

- Q: What is the LinkedIn profile URL? A: https://www.linkedin.com/in/jakub-holecek86/
- Q: GitHub repository or profile? A: The repository
  https://github.com/kubiksk8ter/geogrind (verified as public on 2026-11-27).
- Q: Where are the links? A: In a footer of the side panel.
- Q: Icons for the side panel tabs? A: "Icon and after it the tab label (we can happily make the
  names smaller)."
- Q: Home-screen icon or web manifest with the favicon? A: Favicon, apple-touch-icon and a web
  manifest.
- Not objected to: the analyst's defaults for the favicon look and format, the behaviour of the
  links, the unchanged terms text and no new external service.

Follow-up request before release (translated from Czech; it replaces "unchanged terms text"):

"I would add more icons: 1. Metrics tab: icons for the individual sections (Application, AI).
2. I would remove the e-mail from the terms and move it to the side panel footer as an icon..."

Decisions on the follow-up (translated from Czech): "We will keep the visible e-mail address in
the terms then, but the envelope in the footer still applies."

- The address stays as visible text in "Your rights" and is removed from "About the service".
- The terms version is raised.
- Not objected to: the footer order and the address in the tooltip.
- Decided after seeing the implementation: "We want to open the mail in a new window."
- Decided after testing showed that the mail link still opens in the active window (it replaces
  the previous decision as a requirement): "So let's keep it as it is, so we don't complicate
  things too much. It doesn't matter that much."

## Goal

Give GeoGrind a recognisable identity in browser tabs and on home screens, make the side panel
tabs and metrics groups quicker to recognise, and let visitors of this portfolio demo reach the
source code, the author's LinkedIn profile and the operator's e-mail from the panel footer.

## Scope

### In scope

- A "G" favicon, a matching apple-touch-icon and a web manifest with its icons.
- An icon in front of the label of each side panel tab (History, Metrics, Terms).
- An icon in front of the two group headings of the Metrics tab (Application, AI).
- A side panel footer with icon links to the GitHub repository, the LinkedIn profile and the
  operator's e-mail.
- Moving the operator's e-mail within the terms from "About the service" to "Your rights", the
  changed wording and the new terms version.
- Czech and English texts for everything added or changed.

### Out of scope

- The default whole-world map view (separate item of the same release).
- Offline use, background features, notifications and a custom "install the app" control or
  prompt.
- Social preview images, search engine optimisation and a custom "not found" page.
- Any other new or changed icons (map controls, command input, the sections within the two metrics
  groups, history entries, start-up notice, map failure message). Spec 010's status lights stay
  without icons.
- Links outside the side panel footer (map, start-up notice, map failure screen, new links in the
  Terms text).
- Any other change of the terms text or of the start-up notice.
- A contact form, sending e-mail from the app, a new e-mail address and any change of the contact
  that identifies the app to the geocoder (a separate server setting).

## User stories

- As a visitor, I want a distinct icon on the browser tab so that I can find GeoGrind among my
  tabs and bookmarks.
- As a phone user, I want a proper icon and name when I add GeoGrind to my home screen so that it
  is recognisable and opens like an app.
- As a visitor, I want an icon next to each tab name and metrics group so that I can find the right
  one quickly.
- As a visitor interested in the project, I want links to the source code and the author so that I
  can learn more.
- As a visitor, I want to find the operator's contact easily so that I can ask a question or
  exercise my privacy rights.

## Functional requirements

- FR-1 Favicon design: a white, geometric letter "G" on a dark rounded square in the colour of the
  active side panel tab. It is recognisable at 16 x 16 px, distinguishable on light and dark
  browser tab bars and looks the same on every device (it does not depend on installed fonts).
- FR-2 Favicon: every page of the app, in both languages, declares this icon, and the browser
  shows it for the tab and bookmarks. The master artwork is a vector image (SVG); where one of the
  supported browsers cannot show it, a fallback in another format shows the same design. It also
  applies when the map cannot be loaded.
- FR-3 Apple touch icon: adding the app to the home screen on iPhone or iPad uses the same "G"
  design as a sharp icon with an opaque background and no clipped letter, under the name
  "GeoGrind".
- FR-4 Web manifest: the app provides a web manifest with the name and short name "GeoGrind",
  icons of the same design in the sizes needed for installation (at least 192 and 512 px,
  including a variant that keeps the whole "G" visible when the system crops it to a circle or
  another shape), colours matching the app, and a display as a standalone app window.
- FR-5 Installed start: opening the installed app shows the app at its start address, so the
  language is chosen as for any visit to that address (spec 001). Everything works as in the
  browser; without a network connection no offline behaviour is promised.
- FR-6 Delivery: the icons and the manifest are served by the app's own address, directly (no
  language redirect to a missing page), in development and in production releases.
- FR-7 Tab icons: each side panel tab shows an icon followed by its text label in one row: a
  symbol of past time for History, a chart for Metrics and a document for Terms. The icons are of
  one visual style and follow the text colour in the selected, unselected, hover and focus states.
- FR-8 Tab fit: in both languages every tab shows the icon and the whole label on one line, with no
  truncation, wrapping or overlap, from 320 px screen width and in the side-by-side panel. The
  label text may be made smaller to achieve this, but not below 12 px. The label wording, tab
  order and tab behaviour stay unchanged.
- FR-9 Footer: the side panel has a footer at its bottom edge, visible on every tab. It does not
  scroll away; the tab content scrolls above it and none of it is hidden behind the footer.
- FR-10 Links: the footer holds exactly three icon-only links, in this order: GitHub, LinkedIn
  (both with their recognisable marks) and e-mail (an envelope). Each visible link is 36 x 36 px,
  with no spacing between the links or around their row (the bottom device safe area is still
  respected, NFR-7):
  - GitHub: https://github.com/kubiksk8ter/geogrind
  - LinkedIn: https://www.linkedin.com/in/jakub-holecek86/
  - E-mail: a mail link to jakub.holecek31@gmail.com
- FR-11 Link behaviour: each link is a real link. GitHub and LinkedIn open in a new tab or window
  without passing the referrer or access to the app's page; the app keeps its state (map, panel,
  history). The e-mail link hands a new message to that address to the visitor's mail handler and
  pre-fills no subject or text. Where it opens is up to the browser and the mail handler; a
  webmail handler may replace the app's tab.
- FR-12 Link texts: each link has a native tooltip and an accessible name with the same text, in
  the current language, changing immediately with the language switch:

  | Link | Czech | English |
  |---|---|---|
  | GitHub | Zdrojový kód na GitHubu | Source code on GitHub |
  | LinkedIn | Autor na LinkedInu | Author on LinkedIn |
  | E-mail | Napsat provozovateli: jakub.holecek31@gmail.com | E-mail the operator: jakub.holecek31@gmail.com |

- FR-13 Metrics group icons: the "Application" and "AI" group headings of the Metrics tab each show
  an icon before the heading text: an application window for Application and sparkles for AI, in
  the same style as the tab icons and following the heading colour. Heading texts, order, the
  model name beside the AI heading and the figures stay unchanged and fit without overlap from
  320 px screen width and in the side-by-side panel.
- FR-14 Terms text: in the Czech and English terms the e-mail address is removed from "About the
  service" and appears as visible plain text in "Your rights". Only the following sentences
  change; the rest of both sections and all other sections stay as they are:

  | Section | Replaced sentence | New sentence |
  |---|---|---|
  | About (CS) | "Provozovatel: autor projektu, kontakt <e-mail>." | (A) |
  | About (EN) | "Operator: the author of the project, contact <e-mail>." | (B) |
  | Rights (CS) | "Uplatnění práv: kontakt výše." | (C) |
  | Rights (EN) | "To exercise your rights, use the contact above." | (D) |

  - (A) "Provozovatel: autor projektu. Kontaktovat ho můžete e-mailem přes odkaz s ikonou obálky
    v dolní části tohoto panelu."
  - (B) "Operator: the author of the project. You can contact the operator by e-mail using the
    envelope icon link at the bottom of this panel."
  - (C) "Svá práva můžete uplatnit e-mailem na adrese jakub.holecek31@gmail.com nebo přes odkaz
    s ikonou obálky v dolní části tohoto panelu."
  - (D) "To exercise your rights, send an e-mail to jakub.holecek31@gmail.com or use the envelope
    icon link at the bottom of this panel."

- FR-15 Findable contact: the address can be read as visible text in "Your rights" on every
  device, with or without a mail application. In addition, the e-mail link is visible whenever the
  Terms tab is shown, without scrolling; its name and tooltip contain the full address and
  activating it addresses a new message to it.
- FR-16 Terms version: the change of FR-14 gets a new terms version (the date of the change), so
  the start-up notice is shown once more to every visitor (spec 012 FR-7). The notice texts stay
  unchanged.
- FR-17 Superseded requirements: this spec replaces the parts of spec 012 (draft texts, sections 1
  and 8) and spec 013 (FR-13 and AC-20) that fix where and in which sentence the e-mail address
  appears in the terms. The contact itself stays the same; every other requirement of those specs
  still applies.

## Non-functional requirements

- NFR-1 Cost: no paid service and no new external service; nothing is added that costs money.
- NFR-2 Localisation: every user-visible and accessible text added or changed is in Czech and
  English; Czech terms texts keep the formal address. The product name "GeoGrind" is the same in
  both. The manifest adds no other visible text; if any becomes necessary, it must be provided in
  both languages.
- NFR-3 Browsers: latest Chrome, Firefox, Safari and Edge. Home-screen and installation features
  are required only where the browser and system offer them.
- NFR-4 Privacy: all icons are served by the app itself. Showing them contacts no third party;
  GitHub, LinkedIn and the visitor's mail handler are used only after the visitor activates a
  link.
- NFR-5 Accessibility: tab, metrics heading and footer icons are hidden from screen readers (tab
  and heading names stay their texts, link names are those of FR-12). Links are keyboard-operable,
  have touch targets 36 px wide x 44 px high (extended upwards from the visible link) and contrast
  of at least 3:1 for their icons; tab text keeps at least 4.5:1.
- NFR-6 Focus style: the footer links and the tabs use the shared control focus style (blue glow
  with fading transition, forced-colours variant, inset where an outer glow would be cut off).
  Motion respects reduced motion (spec 004). Icons stay visible with forced colours.
- NFR-7 Responsiveness: usable from 320 px width, portrait and landscape, with no page or
  horizontal panel scrollbars; the footer stays clear of device safe areas.

## Acceptance criteria

- [ ] AC-1: Given the app in either language in the latest Chrome, Firefox, Safari and Edge, when
  the page is open, then the tab shows the "G" icon and no default or missing icon, and no icon
  request fails. (FR-2, FR-6, NFR-3)
- [ ] AC-2: Given the icon at 16 x 16 px on a light and on a dark tab bar, then the "G" is
  recognisable and the icon stands out; it matches the design of FR-1, reviewed by the owner.
  (FR-1)
- [ ] AC-3: Given a device without any particular font, then the icon looks identical, and the
  master artwork is an SVG image. (FR-1, FR-2)
- [ ] AC-4: Given the map fails to load, then the tab still shows the icon. (FR-2)
- [ ] AC-5: Given Safari on iPhone or iPad, when the app is added to the home screen, then it shows
  the sharp "G" icon with an opaque background, an unclipped letter and the name "GeoGrind".
  (FR-3)
- [ ] AC-6: Given the web manifest, then the browser reads it without errors or warnings about its
  content and it states the name, short name, standalone display, colours and icons of FR-4, all
  of which load. (FR-4, FR-6)
- [ ] AC-7: Given a system that crops app icons to a shape, then the whole "G" remains visible.
  (FR-4)
- [ ] AC-8: Given a browser that can install web apps, when the app is installed and opened, then
  it opens in its own window with the "G" icon, shows the app in the language chosen for the start
  address, and commands, panel and language switch work. (FR-4, FR-5, NFR-3)
- [ ] AC-9: Given a production release, then the icons and the manifest load from the public
  address without a redirect to a language path. (FR-6)
- [ ] AC-10: Given the open side panel, then each tab shows its icon followed by its label in one
  row, with the symbols of FR-7, and the icon colour follows the label in every state. (FR-7)
- [ ] AC-11: Given Czech and English at 320 px width, at phone landscape and in the side-by-side
  panel, then all three tabs show full labels on one line without overlap, label text is at least
  12 px, and wording, order and selection work as before. (FR-8)
- [ ] AC-12: Given any tab with content longer than the panel, when it is scrolled, then the footer
  stays at the bottom and the last line of content can be brought fully into view above it. (FR-9)
- [ ] AC-13: Given the footer, then it contains the GitHub, LinkedIn and e-mail links in this
  order, as icons without visible text, with exactly the addresses of FR-10; each visible link is
  36 x 36 px, with no spacing between the links or around the row apart from the safe area. (FR-10)
- [ ] AC-14: Given the GitHub or LinkedIn link, when activated by mouse, touch or keyboard, then
  its address opens in a new tab or window without a referrer or access to the app page, and the
  app's map, panel and history are unchanged. (FR-11)
- [ ] AC-15: Given each language, when a link is hovered or read by a screen reader, then the
  tooltip and name are those of FR-12, and they change at once when the language is switched.
  (FR-12, NFR-2)
- [ ] AC-16: Given keyboard, screen reader and forced colours, then tabs and links are reachable
  and show the shared focus style, icons are not announced, and the touch target and contrast
  limits hold. (NFR-5, NFR-6)
- [ ] AC-17: Given the app is used without activating a link, then no request goes to GitHub or
  LinkedIn, no mail handler is invoked and no new external service is contacted. (NFR-1, NFR-4)
- [ ] AC-18: Given widths from 320 px to desktop, portrait and landscape, then there are no page or
  horizontal panel scrollbars and the footer is not hidden by safe areas. (NFR-7)
- [ ] AC-19: Given a device with a mail application or a webmail mail handler, when the e-mail link
  is activated by mouse, touch or keyboard, then a new message to jakub.holecek31@gmail.com with
  empty subject and text is offered, wherever the browser and mail handler open it. (FR-11, FR-15)
- [ ] AC-20: Given the Metrics tab with figures, in both languages, at 320 px width and in the
  side-by-side panel, then "Application" and "AI" each have the icon of FR-13 before the heading,
  nothing overlaps, no other metrics heading gained an icon, and a screen reader reads the
  headings as before. (FR-13, NFR-5)
- [ ] AC-21: Given the Terms tab in each language, then the e-mail address appears in its text only
  in "Your rights", that section and "About the service" contain the sentences of FR-14 and no
  other text has changed. (FR-14, NFR-2)
- [ ] AC-22: Given the Terms tab from 320 px width, when "Your rights" is read, then the full
  address is visible without overflowing the panel; at any scroll position the e-mail link is
  visible, its name and tooltip contain the address and activating it addresses a message to it.
  (FR-15, NFR-7)
- [ ] AC-23: Given a visitor who acknowledged the previous terms version, when the app is shown,
  then the notice appears with unchanged texts, the Terms tab shows the new version, and after
  acknowledgement the notice does not return. (FR-16)
- [ ] AC-24: Given the checks that verify specs 012 and 013, then those expecting the address in
  "About the service" now expect it in "Your rights" and in the footer link, and all their other
  checks still hold. (FR-17)

## Assumptions

- "We can happily make the names smaller" means a smaller text size of the tab labels, not shorter
  wording.
- The home-screen name is "GeoGrind"; the installed app uses a standalone window, has no forced
  screen orientation and has no manifest description or shortcuts.
- The manifest is shared by both languages because it contains no language-dependent text.
- Third-party marks are shown in one colour that fits the panel, with their shapes unaltered.
- "Sections (Application, AI)" means the two group headings only.
- The e-mail address stays the same (spec 013); only its place changes.
- The address in "Your rights" is plain text, not a further link.
- The e-mail link is last in the footer, and its tooltip and name contain the address (proposed to
  the user, no objection).
- The "About the service" sentences (A) and (B) are the analyst's drafts, kept without objection.
- The contact that identifies the app to the geocoder is a separate server setting and stays
  unchanged, so the terms statement about the operator's identification remains true.
- Plain links and locally served icons send nothing to third parties by themselves, so nothing in
  the terms about stored or sent data changes.
- The links are available only through the side panel; with a failed map there is no panel, no
  Terms tab and no links.
- Czech Republic scope: the feature has no geographic behaviour, so requests about places outside
  the country do not apply and existing command behaviour is unchanged.
- The developer bumps the minor version per the versioning policy (once for this spec) and keeps
  the README in step.

## Open questions / risks

- The wording of FR-14 is a draft, not legal advice; the owner should read it before the commit.
- The browser and mail handler decide where the e-mail link opens: a webmail handler may replace
  the app's tab, so the map position is lost (accepted). Some browsers may instead leave an empty
  new tab or window behind.
- The visible address and the mail link can be read by automated address collectors.
- Every visitor sees the start-up notice once more (accepted by raising the terms version).
- If a label cannot fit at 12 px or more (FR-8), the wording must not be changed without the
  owner's decision. Recommendation: first reduce spacing, then ask the owner. Please also confirm
  that "smaller names" meant text size.
- The visual quality of the "G" is subjective. Recommendation: the owner reviews it at 16 px and as
  a home-screen icon before the commit.
- The links are seen only after opening the panel (accepted by the choice of the footer). On
  phones the footer also takes some height from the tab content.
- Installation support and wording differ between browsers and systems; some offer none.
- GitHub and LinkedIn have brand guidelines for their marks. Recommendation: use the official
  shapes unaltered.
- If the repository is made private or a linked address changes, the links break.
- Suggestion (not requested): a theme colour for the mobile browser bar, matching the manifest.
