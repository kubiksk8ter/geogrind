# 012 – Start-up notice and Terms tab (terms of use and privacy notice)

- **Status:** Draft
- **Date:** 2026-11-19
- **Next agent:** developer

## Original request

Brief for the analyst (translated from Czech; branch feature/terms-and-privacy, from develop).
User decisions, not to be reconsidered:

1. On app start a modal with a notice and an "I understand" button is shown. It is purely
   informative (no blocking consent); what matters is that the user sees the notice.
2. The modal contains a link that opens the "Terms" tab in the side panel.
3. The acknowledgement is stored in localStorage through Zustand (persist). The analyst was
   asked to judge storing the version of the terms text too, so that the modal can be shown again
   when the text changes.
4. The side panel gets a new Terms tab with the full text: terms of use, a warning not to enter
   sensitive data, unreliability of AI, a GDPR text about hashed IPs (key rotated daily, see the
   latest commits of feature/ip-hashing).
5. The CZ/EN switch in the header is done. Find out how localisation works and prepare the texts
   (modal and tab) in Czech and English in line with that mechanism.
6. Propose the texts in the spec for review. Check in the code what the app really stores and
   sends (IP hash, .data/state.json, AI calls, ORS, Nominatim, metrics) so that the text matches
   reality. State that this is a draft, not legal advice.
7. UI: accessible modal (focus trap, closing by key, labels); controls use the focus style from
   sharedConstants (MapLibre-style blue glow with a box-shadow transition); Tailwind is in the
   stack.

Recommend whether the architect is needed or the developer is enough (user's guess: developer).
Versioning: the developer bumps the minor version per spec. Nothing is committed.

Clarifying Q&A:

- Q: Who is the operator and which contact is shown? A: A link to GitHub (profile/repository
  kubiksk8ter). No e-mail and no name.
- Q: Can the language be switched in the modal? A: Yes, a small CZ/EN switch inside the modal;
  the modal stays fully modal and accessible.
- Confirmed analyst defaults: formal address ("vykání") in the Czech UI; "I understand", Escape
  and the link close the modal and store the acknowledgement; a click outside does not close it;
  no flash of the modal before the stored state is read; fallback when localStorage is
  unavailable; tab labels Terms / Podmínky; data subject rights and a complaint to the Czech
  authority (ÚOOÚ) in the text; texts are a draft, not legal advice; OpenFreeMap seeing the IP is
  stated; the developer recommendation is accepted, with a note on handing over to the architect.

## Goal

Make every visitor see, at the start, a short notice that the demo is not for sensitive data, that
AI can be wrong and that the IP address is processed in a pseudonymised form, and give them the
full terms of use and privacy notice in the side panel in their language.

## Scope

### In scope

- A start-up modal with a short notice, a link to the Terms tab, an "I understand" button and a
  small CZ/EN switch.
- Remembering the acknowledgement in the browser together with the version of the terms text, and
  showing the modal again when the version changes.
- A new Terms tab in the side panel with the full text (draft texts below).
- Czech and English texts for everything added.

### Out of scope

- A blocking consent, a cookie banner, accounts, or a record of consent on the server.
- Changes to what the app stores or sends (specs 005, 010, 011). The text only describes it.
- Legal review. The texts are a draft and no legal advice.
- Further languages, printing or downloading of the terms, a separate page for the terms.
- Map layers and routing (ORS is not in the code yet, so the text does not mention it).

## User stories

- As a visitor, I want to see a short notice at the start so that I know not to enter sensitive
  data and that AI can be wrong.
- As a visitor, I want to read the full terms and privacy information in my language so that I
  know what happens with my data.
- As a visitor whose language was guessed wrongly, I want to switch it in the notice so that I can
  read it.
- As a returning visitor, I do not want to see the same notice again until the terms change.
- As the owner, I want the notice to reappear when the terms change so that visitors see the new
  text.

## Functional requirements

- FR-1 Start-up modal: when the app is shown and the visitor has not acknowledged the current
  version of the terms, a modal dialog opens on its own. It blocks interaction with the rest of
  the page until it is closed. It is shown to every visitor regardless of location (no location
  detection).
- FR-2 Modal content: a title, a short list of key points, a link to the full terms, the
  "I understand" button and a CZ/EN switch (draft texts in section "Draft texts").
- FR-3 Closing and acknowledgement: the "I understand" button, the Escape key and the link each
  close the modal and store the acknowledgement of the current terms version. A click outside the
  modal does not close it. There is no other close control.
- FR-4 Link: activating the link closes the modal, opens the side panel and shows the Terms tab.
  On a small screen the panel is full screen, on a large screen it sits beside the map (spec 008
  FR-11, FR-12). The panel and the Terms tab can be reached by the visitor later through the
  normal panel control.
- FR-5 Language switch in the modal: a small CZ/EN switch with the same behaviour as the one in
  the map controls (spec 003). Changing the language changes all modal texts at once, without a
  reload, and keeps the keyboard focus on the switch. Both switches always show the same
  language.
- FR-6 Persistence: the acknowledgement is stored in the browser (localStorage) together with the
  version of the terms it refers to. It is kept across tabs and sessions and is never sent to the
  server. Nothing else about the visitor is stored with it.
- FR-7 Versioning: the terms have one version identifier, kept together with the texts. The modal
  is shown when no acknowledgement is stored or the stored version differs from the current one
  (older or newer). A substantive change of the texts requires a new version; a fix of a typo
  does not. The first version is "2026-11-19".
- FR-8 Unreadable or unavailable storage: if the stored value is missing, corrupt or of an
  unknown shape, it is ignored and the modal is shown. If localStorage is unavailable or full,
  the modal is shown at every page load, the app works and no error is shown. After the
  acknowledgement in such a case the modal does not reappear until the next page load.
- FR-9 No flash: the modal is not rendered until the stored acknowledgement has been read, so a
  visitor who already acknowledged never sees it, not even briefly.
- FR-10 Terms tab: the side panel gets a tab named "Terms" (English) and "Podmínky" (Czech), after
  the existing tabs. It shows the full text (draft texts below) as a headed, readable document
  that scrolls inside the panel. It needs neither the map nor a network connection. Adding it
  follows the existing tab structure (spec 008 FR-3).
- FR-11 Languages of the content: the whole Terms tab and the modal exist in Czech and English and
  follow the language switch immediately.
- FR-12 Accuracy: the texts describe only what the app does at the time of writing (checked
  against the code on 2026-11-19, see "Assumptions"). A later change of what is stored or sent
  requires updating the texts and the version.
- FR-13 Map failure: if the map cannot be loaded (spec 002), the app shows only the failure
  message and the modal is not required.
- FR-14 No effect on commands: once closed, the modal changes nothing about commands, cooldown,
  history or limits, and the acknowledgement makes no request to any server.

## Non-functional requirements

- NFR-1 Cost: no new paid service and no extra external call.
- NFR-2 Localisation: every visible and accessible text added is in Czech and English. The Czech
  texts use formal address ("vykání"), like the rest of the Czech UI.
- NFR-3 Browsers: latest Chrome, Firefox, Safari and Edge.
- NFR-4 Accessibility of the modal: it is a dialog with an accessible name (its title) and an
  accessible description; focus moves into it when it opens and stays inside it (focus trap);
  the page behind is not reachable by keyboard or screen reader; Escape closes it (FR-3); when it
  closes, focus goes to a sensible place (the opened panel after the link; otherwise the command
  input or the first control of the page) and is never lost to the page body.
- NFR-5 Accessibility in general: all controls (link, button, switch) are keyboard-operable with a
  visible focus; text contrast at least 4.5:1, control boundaries at least 3:1; touch targets at
  least 44 px; the Terms tab has real headings and lists in a logical order.
- NFR-6 Focus style: all controls added (link, button, switch, controls in the Terms tab) use the
  shared control focus style from sharedConstants (blue MapLibre-style glow with the box-shadow
  transition, and the forced-colours variant); the inset variant is used where an outer glow
  would be cut off.
- NFR-7 Motion: the opening and closing of the modal respect reduced motion (spec 004).
- NFR-8 Responsiveness: usable from 320 px width, portrait and landscape; the modal fits the
  screen, only its content scrolls when long (large font, small screen); no page scrollbars.
- NFR-9 Privacy: the stored acknowledgement holds no personal data (only the terms version).
- NFR-10 Testability: the show/hide rules, versioning, storage failures and the link to the panel
  can be tested with a simulated storage.
- NFR-11 Extensibility: the terms version is a single place to change; adding another panel tab
  later does not affect this feature.

## Acceptance criteria

- [ ] AC-1: Given a first visit (empty storage), when the app is shown, then the modal opens,
  the rest of the page is not operable and the texts are in the current language. (FR-1, FR-2)
- [ ] AC-2: Given the open modal, when "I understand" is activated by mouse, touch or keyboard,
  then the modal closes, the current terms version is stored, and after a reload the modal is not
  shown. (FR-3, FR-6)
- [ ] AC-3: Given the open modal, when Escape is pressed, then it closes and the acknowledgement
  is stored as in AC-2. (FR-3)
- [ ] AC-4: Given the open modal, when the visitor clicks outside it, then it stays open.
  (FR-3)
- [ ] AC-5: Given the open modal, when the link is activated, then the modal closes, the side
  panel opens on the Terms tab (full screen below 768 px, beside the map from 768 px) and the
  acknowledgement is stored. (FR-3, FR-4)
- [ ] AC-6: Given the open modal, when the language is switched in the modal, then all modal
  texts change at once, the language switch in the map controls shows the same language, the
  focus stays on the modal switch and the page is not reloaded. (FR-5, FR-11)
- [ ] AC-7: Given an acknowledgement stored for an older or a different version, when the app is
  shown, then the modal opens again; given the stored current version, it does not. (FR-7)
- [ ] AC-8: Given a stored value that is corrupt, of an unknown shape or empty, then it is ignored
  and the modal is shown without any error. (FR-8)
- [ ] AC-9: Given localStorage that throws or is full, then the app works, the modal is shown at
  each page load, closes normally and no error is shown. (FR-8)
- [ ] AC-10: Given a visitor with a current acknowledgement, when the page loads, then the modal
  is never rendered, not even for one frame. (FR-9)
- [ ] AC-11: Given the side panel, then it has a Terms tab (Podmínky in Czech) after the existing
  tabs with the full text, which scrolls inside the panel; switching the language changes the
  whole text at once. (FR-10, FR-11)
- [ ] AC-12: Given the Terms tab, then its content matches the draft texts after review, mentions
  every item listed in section "Draft texts" and states that it is a draft only until the owner
  removes that marker. (FR-10, FR-12)
- [ ] AC-13: Given a changed terms version in the code, when the app is shown to a visitor with
  the older acknowledgement, then the modal is shown again. (FR-7)
- [ ] AC-14: Given the map fails to load, then only the failure message is shown and no modal.
  (FR-13)
- [ ] AC-15: Given the acknowledgement and the closing of the modal, then no network request is
  made and commands, cooldown and history behave as before. (FR-6, FR-14)
- [ ] AC-16: Given a keyboard only and a screen reader, then the modal has a name and a
  description, focus enters it and cannot leave it with Tab, the page behind is unreachable,
  and after closing the focus is in the places named in NFR-4. (NFR-4, NFR-5)
- [ ] AC-17: Given the link, button, switch and controls in the Terms tab, then each shows the
  shared blue glow on keyboard focus and on hover with the fading transition, and the
  forced-colours outline. (NFR-6)
- [ ] AC-18: Given reduced motion, then the modal appears and disappears without animation.
  (NFR-7)
- [ ] AC-19: Given widths from 320 px to desktop, portrait and landscape, then there are no page
  scrollbars and only the modal content or the Terms tab scrolls. (NFR-8)
- [ ] AC-20: Given the latest Chrome, Firefox, Safari and Edge, then AC-1, AC-2, AC-5 and AC-6
  pass. (NFR-3)
- [ ] AC-21: Given the stored value, then it contains the terms version and no personal data.
  (NFR-9)
- [ ] AC-22: Given tests with a simulated storage, then AC-1 to AC-10 and AC-13 can be verified
  without a real browser storage failure. (NFR-10)

## Draft texts

**This is a draft for the owner's review, not legal advice. This remark applies to the spec only
and must NOT be shown in the app (neither in the modal nor in the Terms tab).** It must be reviewed (ideally by a
lawyer) before production use. Facts were checked against the code on 2026-11-19. The
Czech text uses formal address. Items marked [verify] are facts the code cannot prove.

Contact of the operator in both languages: the placeholder [TODO]. A public e-mail on the
project's own domain must be filled in before going to production; the placeholder must not
reach production. No personal e-mail and no name.

### Modal

**CS**

- Title: "Vítejte v GeoGrind"
- Point 1: "Do příkazů prosím nepište citlivé ani osobní údaje. Text příkazu zpracovává služba umělé
  inteligence a názvy míst mapová vyhledávací služba."
- Point 2: "Umělá inteligence se občas splete, proto berte výsledky na mapě jako orientační."
- Point 3: "Pro ochranu před přetížením a zneužitím dočasně zpracováváme vaši IP adresu, a to jen ve
  formě pseudonymu s klíčem, který se denně ruší."
- Link: "Podmínky a ochrana osobních údajů"
- Button: "Rozumím"
- Accessible name of the dialog: "Vítejte v GeoGrind"; description: the three points (the modal
  has no intro line).

**EN**

- Title: "Welcome to GeoGrind"
- Point 1: "Please don't enter sensitive or personal data in your commands. The command text is
  processed by an AI service and place names by a map search service."
- Point 2: "AI sometimes gets it wrong, so treat the results on the map as a guide."
- Point 3: "To protect the service against overload and abuse we temporarily process your IP address,
  only as a pseudonym made with a key that is destroyed daily."
- Link: "Terms and privacy"
- Button: "I understand"

### Terms tab

**CS** (tab "Podmínky")

*Podmínky užívání a zásady ochrany osobních údajů* (verze 2026-11-19)

1. O službě. GeoGrind je bezplatná aplikace. Provozovatel: autor projektu, kontakt
   [TODO]. Služba je poskytována „tak, jak je", bez záruky dostupnosti,
   přesnosti ani vhodnosti pro konkrétní účel. Může být kdykoli omezena, změněna nebo ukončena.
2. Pravidla používání. Aplikaci používejte přiměřeně. Počet příkazů je omezen (za minutu, mezi
   dvěma příkazy a za den pro všechny uživatele dohromady). Nepoužívejte automatizované hromadné
   dotazy a nepokoušejte se omezení obcházet. Provozovatel může přístup omezit.
3. Nezadávejte citlivé údaje. Do příkazu nepište osobní, zdravotní ani jiné citlivé údaje a nic,
   co nemá být předáno třetím stranám. Text se odesílá externím službám (viz bod 6).
4. Umělá inteligence není spolehlivá. Příkazy vyhodnocuje model umělé inteligence. Může je
   pochopit špatně nebo odpovědět nepřesně. Místo na mapě a jeho obrys vycházejí z dat
   OpenStreetMap a mohou být neúplné nebo nesprávné. Nespoléhejte se na ně při rozhodnutích, která
   mají vliv na zdraví, bezpečí nebo majetek.
5. Jaké údaje zpracováváme na serveru.
   - IP adresa: z ní se hned po příchodu požadavku vytvoří pseudonym (hash s tajným klíčem). Surová
     IP adresa se neukládá ani nezapisuje do logů. Zpracování probíhá na základě oprávněného zájmu
     (ochrana služby před přetížením a zneužitím funkcí umělé inteligence).
   - Klíč je jen v paměti serveru, nejpozději o půlnoci UTC (nejvýše po 24 hodinách) se ničí a při
     restartu serveru se vytvoří nový. Jde o pseudonymizaci, nikoli anonymizaci: dokud klíč
     existuje, lze pseudonym přiřadit k téže IP adrese.
   - Záznam klienta pro omezení počtu příkazů se maže nejpozději 60 sekund po jeho posledním
     příkazu. Pseudonym je také v paměti přehledu provozu po dobu nejvýše jedné hodiny; po
     restartu je prázdný.
   - Text příkazů na serveru neukládáme. Ukládáme jen souhrnné denní počty (volání AI, tokeny,
     výsledky příkazů), které neobsahují osobní údaje. Logy obsahují jen kód výsledku, dobu
     zpracování a název chyby.
   - Hostitel serveru a případný reverzní proxy server mohou IP adresy zaznamenávat mimo kontrolu
     aplikace. [TODO]
6. Kam se údaje odesílají.
   - Text příkazu a jazyk rozhraní: poskytovateli umělé inteligence Groq (USA), který
     příkaz vyhodnotí. Předávání údajů do USA je ošetřeno standardními smluvními doložkami (SCC)
     v rámci podmínek poskytovatele.
   - Název místa: veřejné vyhledávací službě Nominatim (OpenStreetMap). Posílá se s identifikací
     provozovatele, nikoli s vaší IP adresou ani vaším pseudonymem.
   - Mapový styl a dlaždice stahuje váš prohlížeč přímo ze služby OpenFreeMap. Ta proto vidí vaši
     IP adresu a běžné údaje o požadavku podle vlastních zásad.
   - Nepoužíváme analytiku, reklamu ani sledovací nástroje.
7. Údaje ve vašem prohlížeči. Používáme pouze technicky nezbytné údaje ve vašem prohlížeči.
   Historie příkazů (sessionStorage) se smaže se zavřením karty. Konec pauzy mezi příkazy
   a potvrzení těchto podmínek s číslem verze (localStorage) zůstávají, dokud je nesmažete.
   Volba jazyka je v cookie, která platí do konce relace prohlížeče. Nic z toho neslouží ke
   sledování a potvrzení se na server neodesílá.
8. Vaše práva. Máte právo na přístup, výmaz, omezení zpracování a námitku proti zpracování
   a právo podat stížnost u Úřadu pro ochranu osobních údajů (www.uoou.cz). Po zničení klíče nelze
   pseudonym k vám přiřadit, a údaj proto už nelze vyhledat. Uplatnění práv: kontakt výše.
9. Změny. Podmínky se mohou změnit. Při změně textu se upozornění zobrazí znovu.

**EN** (tab "Terms")

*Terms of use and privacy notice* (version 2026-11-19)

1. About the service. GeoGrind is a free application. Operator: the author of the project, contact
   [TODO]. The service is provided "as is", with no guarantee of
   availability, accuracy or fitness for any purpose. It may be limited, changed or ended at any
   time.
2. Rules of use. Use the application reasonably. The number of commands is limited (per minute,
   between two commands and per day for all users together). Do not use automated bulk requests
   and do not try to bypass the limits. The operator may restrict access.
3. Do not enter sensitive data. Do not write personal, health or other sensitive data in a
   command, or anything that must not be passed to third parties. The text is sent to external
   services (see section 6).
4. AI is not reliable. Commands are interpreted by an AI model. It may misunderstand a command or
   answer inaccurately. The place on the map and its outline come from OpenStreetMap data and may
   be incomplete or wrong. Do not rely on them for decisions that affect health, safety or
   property.
5. What we process on the server.
   - IP address: right after a request arrives it is turned into a pseudonym (a hash made with a
     secret key). The raw IP address is not stored or written to logs. The processing is based on
     legitimate interest (protecting the service against overload and abuse of the AI features).
   - The key exists only in the server's memory. It is destroyed at the latest at midnight UTC (at
     most after 24 hours), and a new one is created when the server restarts. This is
     pseudonymisation, not anonymisation: while the key exists, the pseudonym can be matched to the
     same IP address.
   - The client record used for the command limits is deleted at the latest 60 seconds after the
     client's last command. The pseudonym is also kept in the memory of the traffic overview for at
     most one hour; it is empty after a restart.
   - We do not store the text of commands on the server. We store only daily totals (AI calls,
     tokens, command results), which contain no personal data. Logs contain only a result code, the
     processing time and an error name.
   - The server host and any reverse proxy may record IP addresses outside the control of the
     application. [TODO]
6. Where data is sent.
   - The text of the command and the interface language go to the AI provider Groq (USA),
     which interprets the command. The transfer of data to the USA is covered by standard
     contractual clauses (SCC) within the provider's terms.
   - The place name goes to the public search service Nominatim (OpenStreetMap). It is sent with
     the operator's identification, not with your IP address or your pseudonym.
   - Your browser downloads the map style and tiles directly from OpenFreeMap. That service
     therefore sees your IP address and the usual request data under its own policy.
   - We use no analytics, advertising or tracking tools.
7. Data in your browser. We use only technically necessary data in your browser. The command
   history (sessionStorage) is deleted when you close the tab. The end of the pause between
   commands and the acknowledgement of these terms with its version number (localStorage) stay
   until you delete them. The language choice is in a cookie that lasts until the end of the
   browser session. None of it is used for tracking, and the acknowledgement is not sent to the
   server.
8. Your rights. You have the right of access, erasure, restriction and objection, and the right to
   complain to the Czech Office for Personal Data Protection (www.uoou.cz). After the key has been
   destroyed the pseudonym can no longer be matched to you, so the data can no longer be found.
   To exercise your rights, use the contact above.
9. Changes. The terms may change. When the text changes, the notice is shown again.

## Assumptions

- Facts behind the texts were checked in the code on 2026-11-19: the client identifier is an IPv4
  address or the /64 prefix of an IPv6 address and becomes an HMAC-SHA-256 pseudonym right after
  the request (spec 011); the key lives in memory and ends at the next UTC midnight or restart;
  client records live at most 60 s; the metrics window keeps pseudonyms in memory for one hour; the
  state file holds daily counters, an AI pause and client records; logs hold a result code,
  duration and an error name; Groq receives the typed text and the UI language; Nominatim receives
  the place name and the operator contact in the User-Agent; the browser loads the style and tiles
  from OpenFreeMap; history is in sessionStorage; the cooldown end is in localStorage; the language
  is in a session cookie (as the code comment says); there are no analytics libraries.
- Routing (ORS) is not in the code, so the texts do not mention it. When it is added, the texts
  and the terms version change.
- The Czech Republic scope: the notice is not tied to a place and is shown to every visitor.
  Places outside the country can be searched as before (spec 005); the texts do not restrict this.
- The acknowledgement is stored without a timestamp; only the terms version is needed.
- Opening the full terms through the link counts as having seen the notice (FR-3). Escape does too,
  so that the notice does not return at every page load for visitors who dismiss it.
- The version identifier is a date in the form YYYY-MM-DD, but any value that changes with the
  text is acceptable (developer's choice).
- The tab label for Czech is "Podmínky", for English "Terms" (the user said "Terms").
- The modal does not use the map; it can appear while the map is still loading. The Terms tab
  needs no map (FR-10).
- The developer bumps the minor version per the versioning policy.
- The modal, the panel and the persisted flag follow existing patterns (history store with storage,
  `PANEL_TABS`, shared focus styles, the available UI library of spec 003 FR-14).

## Open questions / risks

- Risk: the texts are a draft and no legal advice. The legal basis, the retention statements, the
  rights wording and the claim about the Groq location must be confirmed by the owner (a lawyer
  is advisable) before going to production. The two [verify] marks must be resolved.
- Risk: the side panel state (open, active tab) is local to the map view and the panel today and
  the modal must be able to open it on the Terms tab. If lifting that state proves invasive for
  the existing structure, the developer must hand the task over to the architect instead of
  redesigning it alone.
- Risk: counting Escape and the link as acknowledgement means a visitor can dismiss the notice
  without reading it. Accepted by the user's decision that the notice is informative only.
- Risk: if the map fails to load (FR-13), the visitor sees no notice. Nothing is sent to any
  service then, so this is accepted.
- Risk: the Czech UI texts in the draft use formal address; a more informal tone is a text change
  only.
- Suggestion (not requested): a "show the notice again" entry or a link in the footer area; the
  OpenStreetMap/OpenFreeMap attribution in the terms; a short reminder in the History tab that its
  content stays in the tab's session storage.
- Follow-up: README text about what the server stores should link to this spec when it is done.
- Recommendation: **developer**. No new module, external service, API or AI work. One small
  persisted state following the history pattern, one tab at the documented extension point, one
  modal and texts. Borderline against the rule that state management means an architect, because
  of the panel state mentioned above; see the risk. The developer hands over to the architect if
  that change proves invasive.
