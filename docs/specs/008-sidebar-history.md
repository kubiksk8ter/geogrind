# 008 – Side panel with command history

- **Status:** Draft
- **Date:** 2026-11-11
- **Next agent:** architect

## Original request

New feature for GeoGrind (branch feature/sidebar-history, from develop). User brief (translated
from Czech):

- A slide-out side panel on the right side of the app with the history of the user's inputs.
- The panel has tabs. Now only History; later token usage measurement from Groq and an app
  description with terms of use (terms and privacy notice TODO). Propose an extensible
  structure, but implement only the History tab.
- History is kept in global state (the user considers Redux; the library decision belongs to
  the architect) and persisted in session storage.
- An entry is stored only after a successful command. If Groq does not find a place on the map
  and an error occurs, nothing is stored.
- A history entry holds both the command (Groq output) and its Nominatim result. Clicking an
  entry runs the command again without another Groq call (and without a needless Nominatim
  call, if possible).
- Mobile: the panel opens full screen; after clicking an entry the command is run and the panel
  hides.
- Desktop: the panel need not hide after clicking an entry.
- Portfolio demo with low traffic.

No clarifying questions were needed; conventional defaults are listed under *Assumptions*.

## Goal

Let a user return to places they already looked up in this browser session with one click,
saving the AI quota and geocoder requests, and give the app a panel that later tabs
(usage, about and terms) can join.

## Scope

### In scope

- A side panel on the right, opened and closed by the user, with a tab structure.
- A History tab (the only tab now) listing successful commands of the current session.
- Storing a history entry after each successful command; keeping history for the browser session.
- Re-running an entry from the panel without any server call.
- Small-screen (full screen) and large-screen behaviour of the panel.
- CZ/EN texts for everything added.

### Out of scope

- The other tabs (token usage from Groq, app description, terms and privacy notice). Only the
  structure must allow adding them without reworking the panel (FR-3).
- Map layers, route A to B, accounts, history shared between devices or tabs.
- Storing failed, unsupported, rejected or "not found" commands.
- Deleting single entries, searching, exporting or editing the history (see *Open questions*).
- Changes to the server API, cooldown, limits and messages of spec 005, or to highlight rules
  of spec 007.

## User stories

- As a user, I want to see my earlier successful commands so that I do not have to retype them.
- As a user, I want to click an earlier command and see the map go there again, instantly and
  without using the AI quota.
- As a phone user, I want the panel to cover the screen and close itself after I pick an entry so
  that I see the map right away.
- As a desktop user, I want the panel to stay open after I pick an entry so that I can try
  several entries in a row.
- As the team, I want a tabbed panel so that usage and terms tabs can be added later.

## Functional requirements

- FR-1 Panel: a control opens and closes a panel attached to the right edge of the app. On a small
  screen it covers the map; on a large screen the map is narrowed beside it, so the zoom
  buttons and language switch stay visible (see *Assumptions*). The open/closed state does not need to
  survive a reload.
- FR-2 Closing: the user can close the panel with a visible close control and with the Escape
  key.
- FR-3 Tabs: the panel is organised in tabs. Only "History" exists now. Adding a further tab
  later requires only describing the new tab and its content, not changing how the panel opens,
  closes or lays out. No placeholder or "coming soon" tabs are shown.
- FR-4 What is stored: after a command succeeds (the server answers with a zoom result), one
  history entry is created. It holds the action, the text the user typed (the AI's place name
  is not available in the browser and is not stored; the server API is not changed), the time the command succeeded (taken from the browser clock
  when the answer arrives), and the geocoder result that the server sent (target view and, if
  present, highlight geometry). A re-run does not change the stored time.
- FR-5 What is not stored: unsupported commands, place not found, generic errors, "wait", "too
  many requests", "AI is resting", invalid requests, and a map that is not ready create no entry
  and change no existing entry.
- FR-6 Persistence: history lives in application-wide state and is mirrored to session storage,
  so it survives a page reload and a language switch within the same browser tab and disappears
  when the tab or browser session ends. It is never sent to the server.
- FR-7 Display: the History tab lists entries newest first. Each shows the text the user typed
  (as typed, not translated), plus the time of the
  command in a subdued style: time only for today, date and time for earlier days, formatted
  for the current language (Czech or English) and changing with the language switch. An empty
  history shows a short localised empty message.
- FR-8 Re-run: clicking (or activating by keyboard) an entry moves the map to the stored target
  and shows the stored highlight exactly as the original command did (spec 007, including the
  fade-out timer and the removal of the previous highlight). This makes no request to the AI
  step or the geocoder, shows no loading state, and starts no cooldown and counts toward no limit.
- FR-9 Re-run and input state: a re-run does not change the text in the command input, does not
  shorten or restart a running cooldown, and works while the input is paused by a cooldown.
  While a command request is in flight, entries cannot be activated (the result of the running
  command must not be overwritten unexpectedly).
- FR-10 Order and duplicates: a re-run does not create a new entry and does not reorder the list.
  A new successful command always creates a new entry, even for the same place (the entry
  records what was typed).
- FR-11 Small screens: when the panel is open it fills the whole screen. Activating an entry
  runs it (FR-8) and closes the panel, so the map is visible. The close control and Escape
  also work.
- FR-12 Large screens: the panel is a side panel of limited width; the map stays visible and
  usable beside it. Activating an entry runs it and leaves the panel open.
- FR-13 Size limit: history keeps at most 50 entries; adding one more removes the oldest. If
  session storage is unavailable, full or holds unreadable data, the app keeps working with
  history in memory only for that page view and shows no error; unreadable stored data is
  ignored and replaced. Under storage quota pressure (e.g. many large highlights) memory keeps
  all entries, while storage keeps the newest entries that fit; after a reload the oldest
  entries may therefore be missing.
- FR-14 Stored data is trusted no more than server data: on load, entries are checked against
  the same shape and ranges as a server answer (spec 005 FR-8, spec 007 FR-9), and the stored
  time must be a valid timestamp; invalid entries are dropped silently.
- FR-15 Map not ready: if the map failed to load (spec 002) the panel control is not shown.
  While the map is not ready, an entry cannot be activated.
- FR-16 Texts: the panel control, panel and tab names, close control, empty message and
  accessible names exist in Czech and English and follow the language switch immediately
  without a reload. Entry content is user data and is not translated.

## Non-functional requirements

- NFR-1 Cost: no new paid service; the feature uses no server resources at all.
- NFR-2 Localisation: see FR-16.
- NFR-3 Accessibility: the control, tabs, entries and close are keyboard-operable with a visible
  focus; tabs, list and panel have accessible names and roles; opening moves focus into the
  panel and closing returns it to the control; on a small screen, while the panel is open, the
  map and input behind it are not reachable by keyboard or screen reader; text contrast 4.5:1,
  control boundaries 3:1; touch targets of the control and entries at least 44 px.
- NFR-4 Motion: the slide in and out respects reduced motion (no animation then), as in spec 004.
- NFR-5 Privacy: history contains typed text, so it stays only in session storage of the
  browser tab; it is not logged or sent anywhere (consistent with spec 005 FR-15).
- NFR-6 Extensibility: the state and the tab structure are designed so that further tabs and
  further kinds of history entries (e.g. a future route command, spec 005 NFR-7) can be added
  without changing existing entries' meaning or breaking stored session data of the same tab.
- NFR-7 Performance: opening the panel and re-running an entry feel instant (re-run needs no
  network); 50 entries with highlight geometry do not noticeably slow the page.
- NFR-8 Responsiveness: usable from 320 px width up, portrait and landscape, with no page
  scrollbars; only the entry list scrolls when long.
- NFR-9 Browsers: latest Chrome, Firefox, Safari, Edge.
- NFR-10 Testability: storing rules, persistence, validation of stored data, re-run without
  network and the small/large screen behaviour are covered by automated tests with simulated
  server answers and storage.

## Acceptance criteria

- [ ] AC-1: Given the map is ready, then a control on the right opens the panel with a History
  tab; the close control and Escape close it. (FR-1, FR-2, FR-3)
- [ ] AC-2: Given no command has succeeded yet, then the History tab shows the empty message in
  the current language. (FR-7, FR-16)
- [ ] AC-3: Given a successful "Zoom to Brno", then an entry with that text appears at the top of
  the list with the stored command, result and time, shown in the current language's format.
  (FR-4, FR-7)
- [ ] AC-4: Given an unsupported command, a not-found place, a generic error, a "wait", "too many
  requests" or "AI is resting" answer, or a submit before the map is ready, then the list is
  unchanged. (FR-5)
- [ ] AC-5: Given entries exist, when the page is reloaded or the language switched, then the
  entries are still there (under quota pressure the oldest may be missing, FR-13); given a new tab or ended session, then history is empty. Nothing is
  sent to the server. (FR-6, NFR-5)
- [ ] AC-6: Given an entry with a highlight, when it is activated, then the map moves to the
  stored view, the previous highlight is replaced, the new one is shown and fades as in spec
  007, and no request to the AI step or the geocoder is made. (FR-8)
- [ ] AC-7: Given the input is in a cooldown, when an entry is activated, then the map moves,
  the countdown and the typed text are unchanged. (FR-9)
- [ ] AC-8: Given a request is running, then entries cannot be activated. (FR-9)
- [ ] AC-9: Given an entry is re-run, then the list order and length are unchanged; given the
  same place is commanded again, then a second entry is added. (FR-10)
- [ ] AC-10: Given a small screen, then the open panel fills the screen; activating an entry
  moves the map and closes the panel. (FR-11)
- [ ] AC-11: Given a large screen, then the map stays visible beside the panel; activating an
  entry moves the map and the panel stays open. (FR-12)
- [ ] AC-12: Given 50 entries and a new success, then the oldest entry is gone and the list has
  50. Given session storage that throws, is full, or holds corrupt or out-of-range data, then
  the app works, shows no error and invalid entries are ignored. (FR-13, FR-14)
- [ ] AC-13: Given the map failed to load, then no panel control is shown. (FR-15)
- [ ] AC-14: Given the language switch, then all panel texts change at once; entry text does
  not. (FR-16)
- [ ] AC-15: Given a keyboard only and a screen reader, then the panel, tabs, entries and close
  are operable and named; focus moves into the panel and back; on a small screen the content
  behind is not reachable while open. (NFR-3)
- [ ] AC-16: Given reduced motion, then the panel appears and disappears without animation.
  (NFR-4)
- [ ] AC-17: Given a panel code structure with one tab, when a second tab is described, then it
  appears without changes to opening, closing or layout (verified in the design). (FR-3, NFR-6)
- [ ] AC-18: Given 320 px to desktop widths, portrait and landscape, then there are no page
  scrollbars and only a long list scrolls. (NFR-8)
- [ ] AC-19: Tests for AC-3 to AC-12 run without a real AI, geocoder or browser storage failure
  being required. (NFR-10)
- [ ] AC-20: AC-1, AC-3, AC-6, AC-10 and AC-11 pass in the latest Chrome, Firefox, Safari and
  Edge. (NFR-9)

## Assumptions

- Scope and ranges follow current behaviour: specs 005/007 apply (search is not restricted
  beyond what spec 005 decides); history re-runs whatever the server once returned, so no
  place outside the Czech Republic can appear that the app would not already have shown.
- Entry label is the text the user typed (already normalised, max 200 characters); the
  time of the command is stored and shown next to it (FR-4, FR-7). No resolved place name is
  shown: the server answer does not carry it and the API stays unchanged.
- The stored result is the server's zoom answer (view plus optional highlight); a re-run needs
  no revalidation against the server. Replay highlight timers restart (spec 007 FR-11).
- Small screen means viewport width below 768 px; there the panel is full screen (FR-11). From
  768 px up the panel sits beside the map, which is narrowed by the panel width so that the
  zoom buttons, language switch and command input stay usable (FR-12). A phone in landscape
  wider than 768 px gets the large-screen behaviour.
- Sessions: "session storage" means the tab-scoped browser feature; history is per tab.
- 50 entries is a conventional cap for a low-traffic demo; roughly 5 MB of storage is a
  browser limit that highlight geometry (spec 007 FR-7, up to 5,000 positions) can approach,
  so storage failures are handled gracefully (FR-13).
- Control position, icon and panel width are chosen by the architect/developer; the control
  must not collide with the zoom buttons, language switch, attribution or the command input.
- Choice of the state library (Redux or other) is made by the architect; this spec fixes only
  behaviour. UI library choice of spec 003 FR-14 applies to tabs and panel.
- Version bump follows the versioning policy.

## Open questions / risks

- Risk: the command input (bottom centre) and the panel compete for space on small screens;
  full-screen panel (FR-11) removes the conflict, large screens need a check at 768 px.
- Risk: spec 003 puts the zoom buttons and language switch top right, where the panel opens;
  the architect decides whether the panel pushes them aside or covers them on large screens.
- Risk: session storage size with many highlighted entries (FR-13 covers failure, not loss of
  entries).
- Risk: user text stays in session storage until the tab closes; shared computers are a
  minor concern. The privacy notice TODO should mention it.
- Suggestion: "clear history" button and per-entry delete; not requested.
- Suggestion: show a mark for entries that have a highlight.
- Recommendation: **architect**. Global state, a new persistence layer, a cross-cutting change
  (panel UI, command flow, map) and a tab structure for later features.
