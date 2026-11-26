# 009 – Side panel "Metrics" tab, phase 1: AI (Groq) usage

- **Status:** Draft
- **Date:** 2026-11-13
- **Next agent:** architect

## Original request

Brief for the analyst (translated from Czech; branch feature/sidebar-metrics):

Add a new tab "Metrics" (CZ/EN) to the side panel. In phase 1 it shows Groq AI usage:

1. Tokens of the last request: prompt / completion / total, from `usage` in the Groq answer.
2. Token total per session or per day. It must be kept on the server. The analyst recommends
   session or day.
3. Remaining limits and renewal:
   - Remaining requests and tokens from the headers `x-ratelimit-remaining-requests` and
     `x-ratelimit-remaining-tokens`.
   - Countdown to reset from `x-ratelimit-reset-requests` and `x-ratelimit-reset-tokens`. The
     values are relative with units (e.g. `2m59.56s`), so they must be parsed.
   - Preferably shown as a progress bar.
4. Use of `DAILY_CAP`, e.g. 37 / 500 requests today.
5. The active model (`GROQ_MODEL`).

Notes and constraints from the brief:

- Groq has no endpoint for the remaining quota. The data comes from the body and headers of a
  normal answer in `groqClient.ts` (src/server/ai/), so the client's return type must be
  extended.
- The request limit is daily and the token limit is per minute. The UI must show this clearly
  and must not suggest a daily token limit.
- Before the first request after a start there is no data. An empty state is needed.
- Visualisation: Base UI has a Meter component that can cover progress bars. Other
  visualisations may be done in SVG. Whether to use a library is the architect's decision.
- Keep the control style (blue glow focus) and the CZ/EN translations.
- No request content and no API key may get into the metrics.
- Real-time load of the application is phase 2 and out of scope here.

Questions for the architect: where to keep the counters so that they survive a restart or
sharing between instances (DAILY_CAP has the same question); how data reaches the UI (polling
or an update after each AI request).

No clarifying questions were needed; defaults are listed under *Assumptions*.

## Goal

Let anyone see how much of the free Groq quota the app has used and how much is left, so the
"AI is resting" state (spec 005 FR-13) is understandable and the free tier can be watched
without opening the Groq console. It also adds the second tab to the panel of spec 008.

## Scope

### In scope

- A "Metrics" tab in the side panel, after "History", showing the five items of the brief.
- Collecting usage figures, rate-limit figures and reset times from every Groq answer.
- Server-held daily token total and a read-only way for the browser to get the figures.
- Parsing of the relative reset durations and a live countdown.
- Empty, partly known and outdated states.
- CZ/EN texts for everything added.

### Out of scope

- Real-time application load (phase 2) and any non-AI metric (geocoder, map, visitors).
- Per-user, per-IP or per-session figures; history or charts over several days.
- Any control that changes limits, the cap or the model; alerts or notifications.
- Changes to the command flow, cooldown, rate limits or the daily cap rules of spec 005
  (the cap is only displayed).
- Showing request content, typed text, API key, IP addresses or raw Groq answers.

## User stories

- As a visitor, I want to see how many tokens the last AI command used so that I understand the
  cost of a command.
- As the owner of the demo, I want to see the day's token total, remaining requests and tokens
  and when they renew so that I can tell if the free tier is about to run out.
- As a visitor who saw "AI is resting", I want to see the daily cap used up so that I know why.
- As a user, I want an empty state that tells me the data appears after the first command.

## Functional requirements

- FR-1 Tab: the side panel has a second tab "Metrics" placed after "History". Opening and
  closing, layout and the small/large screen behaviour of spec 008 are unchanged. The tab is
  available whenever the panel is (spec 008 FR-15).
- FR-2 Last request: shows prompt, completion and total tokens of the most recent AI request
  that returned `usage`. Values are whole numbers formatted for the current language. It
  includes requests whose output was later rejected as invalid (they used quota); it excludes
  requests with no `usage` (e.g. refused with 429, network failure).
- FR-3 Daily total: shows the sum of total tokens of all AI requests since 00:00 UTC (the same
  day boundary as the daily cap), for all users together. The figure is kept on the server,
  starts again at 0 at the next UTC midnight, and is updated by every AI request under FR-2's
  inclusion rule. A day without requests shows 0. See *Assumptions* for why "day", not "session".
- FR-4 Remaining limits: shows remaining requests and remaining tokens with their limits, from
  the latest Groq answer's rate-limit headers (remaining and limit values). Each is shown as a
  number "remaining / limit" and as a progress bar (a bar full means all remaining). A refused
  answer (HTTP 429) updates these figures too, if it carries the headers.
- FR-5 Period labels: the requests limit is labelled as per day and the tokens limit as per
  minute, in both languages. The wording and layout must not suggest a daily token limit, and
  the per-minute token figure is never presented as a total or as part of the daily token total.
- FR-6 Reset countdown: for requests and for tokens separately, shows the time left to the
  reset, from the relative reset headers. The parser accepts the formats Groq sends, i.e. a
  sequence of number+unit parts such as `2m59.56s`, `7.66s`, `1h2m3s`, `250ms`, `1d2h`. The
  countdown is computed from the moment the answer was received on the server and decreases
  live in the browser without new requests; it is shown in a short localised form (e.g.
  "2 min 60 s" is never shown: seconds are rounded up and carried into minutes). A missing or
  unparsable value shows "unknown" and never breaks the tab.
- FR-7 Elapsed reset: when the countdown reaches zero before a newer answer, the tab shows that
  the limit has been renewed and the figure is out of date until the next request (it does not
  show the old remaining value as current and does not invent a new one).
- FR-8 Daily cap: shows the app's own daily cap usage as "used / cap" with a progress bar,
  labelled as AI requests today (UTC day), with the time of the next reset (next UTC midnight).
  It uses the same counter and cap value as the limits of spec 005 and is distinct in label
  from the Groq requests limit of FR-4, so the two are not confused.
- FR-9 Model: shows the model currently in use (the configured `GROQ_MODEL`, or its default).
  Model name is shown even before the first request. It is shown as is, not translated.
- FR-10 Empty state: before the first AI request after a start (nothing known), the tab shows a
  short localised message that data appears after the first command, in place of the figures of
  FR-2 and FR-4 to FR-6. FR-8 and FR-9 are known without a request and are shown. FR-3 is shown
  if the server has the stored figure, otherwise it counts as unknown.
- FR-11 Partly known: when only some figures exist (e.g. a refused answer without `usage`, or
  headers missing), each item shows what is known and "no data" for the rest; no item shows 0
  or 100 % as a stand-in for unknown.
- FR-12 Freshness: opening the tab shows the current figures without a manual reload. While
  the tab is visible, a new AI request by any user is reflected within 15 s. Reading the figures
  makes no call to Groq or any other external service and does not count toward the cooldown,
  rate limits or the daily cap. The delivery mechanism is the architect's decision.
- FR-13 Failure to load: if the figures cannot be fetched, the tab shows a short localised
  message, keeps the last figures it had (marked as possibly out of date) and the rest of the
  app, including History, is unaffected. It retries without user action.
- FR-14 Data content: the figures contain only numbers, times, the model name and the cap.
  Typed text, model output, the API key, IP addresses and raw headers or bodies are never stored
  for or sent to the metrics.
- FR-15 Access: figures are readable only by the app's own pages (same origin as spec 005
  FR-5), read-only, with the same error shape for all failures and no permissive cross-origin
  headers. Figures are public to every visitor of the app (see *Assumptions*).
- FR-16 Texts: tab name, headings, labels (including the period labels of FR-5), empty and
  error messages, "unknown", "no data", unit names, countdown format and accessible names exist
  in Czech and English and follow the language switch at once without reload or new fetch.
  Numbers and durations are formatted for the current language.

## Non-functional requirements

- NFR-1 Cost: no new paid service; no extra Groq calls are made to obtain the figures.
- NFR-2 Localisation: see FR-16.
- NFR-3 Accessibility: the tab is keyboard-operable with visible focus in the project's blue
  glow style; each progress bar has an accessible name, current value, minimum and maximum, and
  a text equivalent; meaning is never given by colour alone; text contrast 4.5:1, bar boundary
  3:1; the live countdown is not announced every second (at most when it ends); updates of the
  figures are not announced as interruptions.
- NFR-4 Motion: bar and number changes respect reduced motion as in spec 004 (no animation
  then).
- NFR-5 Privacy: see FR-14; no cookies or identifiers are added to tell visitors apart; nothing
  is written to the browser's storage.
- NFR-6 Robustness: unexpected, missing, negative, non-numeric or oversized values in Groq
  answers never break the command flow, the panel or the tab; values are checked before being
  stored or shown. A failure of collecting metrics never fails or slows an AI command.
- NFR-7 Concurrency and persistence: simultaneous AI requests do not lose or double count
  tokens. The daily total and the daily cap counter follow the same persistence rules (spec 005
  NFR-4); the architect decides what survives a restart and records it in the design. Values
  that do not survive are shown as unknown after a start (FR-10).
- NFR-8 Extensibility: figures are grouped by source ("AI" now) so that phase 2 (application
  load) can add a group without changing the existing ones or the tab structure.
- NFR-9 Responsiveness: usable from 320 px up, portrait and landscape, no page scrollbars;
  only the tab content scrolls when it is long.
- NFR-10 Browsers: latest Chrome, Firefox, Safari, Edge.
- NFR-11 Testability: header parsing (all formats, invalid input), day rollover, concurrent
  updates, the empty/partly known/outdated states and the 429 case are covered by automated
  tests with simulated Groq answers and simulated time, without a real Groq call.

## Acceptance criteria

- [ ] AC-1: Given the panel is open, then the tabs "History" and "Metrics" are shown in this
  order; the open/close behaviour of spec 008 is unchanged. (FR-1)
- [ ] AC-2: Given a successful command with simulated `usage` 120 / 30 / 150, then the tab shows
  prompt 120, completion 30, total 150. Given a following answer rejected for invalid output
  with `usage` 100 / 20 / 120, then these values show as the last request. (FR-2)
- [ ] AC-3: Given an answer with 429 and no `usage`, then the last-request figures are
  unchanged and the daily total does not change. (FR-2, FR-3)
- [ ] AC-4: Given requests with totals 150 and 120 on one UTC day, then the daily total is 270;
  after UTC midnight (simulated) it is 0 until the next request; two simultaneous requests are
  both counted. (FR-3, NFR-7)
- [ ] AC-5: Given headers remaining-requests 480 / limit 500 and remaining-tokens 6000 / limit
  8000, then the tab shows "480 / 500" and "6 000 / 8 000" (Czech and English formats) with bars
  at 96 % and 75 %; a 429 answer with the headers updates them. (FR-4)
- [ ] AC-6: Given the tab in either language, then the requests figure is labelled per day and
  the tokens figure per minute, and no text or layout presents a daily token limit. (FR-5)
- [ ] AC-7: Given reset values `2m59.56s`, `7.66s`, `1h2m3s`, `250ms` and `1d2h`, then they
  parse to 179.56 s, 7.66 s, 3723 s, 0.25 s and 93600 s; the displayed time rounds seconds up
  without showing 60 s; garbage such as `abc`, an empty or negative value shows "unknown". (FR-6)
- [ ] AC-8: Given a countdown of 10 s on screen, then it decreases without new requests and,
  when it reaches zero, the item shows "renewed, figure out of date" until the next answer.
  (FR-6, FR-7)
- [ ] AC-9: Given 37 requests counted today and cap 500, then the tab shows "37 / 500" labelled
  as app AI requests today with a bar and the time to the next UTC midnight; with the cap
  reached it shows 500 / 500. (FR-8)
- [ ] AC-10: Given `GROQ_MODEL` set or not set, then the tab shows the model actually used;
  it is shown before the first request. (FR-9)
- [ ] AC-11: Given a fresh start with no AI request, then the tab shows the empty message
  (CZ/EN), the model and the cap usage, and no zero or 100 % stand-ins. (FR-10, FR-11)
- [ ] AC-12: Given an answer without `usage` or with some headers missing, then each item shows
  its known part and "no data" for the rest, and nothing breaks. (FR-11, NFR-6)
- [ ] AC-13: Given the tab is open and another request completes, then the figures change
  within 15 s without a reload; opening the tab shows current figures. Reading them makes no
  Groq or geocoder call and changes no cooldown, rate-limit or cap counter. (FR-12)
- [ ] AC-14: Given the figures cannot be fetched (simulated), then the tab shows a localised
  message with the last figures marked out of date, History still works, and the tab recovers
  by itself when the fetch works again. (FR-13)
- [ ] AC-15: Given typed text, model output, the API key and an IP address in test data, then
  none of them appears in the stored figures, the fetch answer or the screen. (FR-14, NFR-5)
- [ ] AC-16: Given a request from a foreign origin or with another method, then it is rejected
  and shows no figures. (FR-15)
- [ ] AC-17: Given the language switch, then every text and number format in the tab changes at
  once with no new fetch; all texts exist in both languages. (FR-16)
- [ ] AC-18: Given keyboard only and a screen reader, then the tab is operable, bars expose
  name, value, min and max, the countdown is not announced each second; focus uses the blue
  glow style. (NFR-3)
- [ ] AC-19: Given reduced motion, then bars and numbers change without animation. (NFR-4)
- [ ] AC-20: Given negative, non-numeric, huge or missing header and `usage` values (simulated),
  then the AI command still works and the tab shows "no data" for the bad items. Given a failure
  in collecting metrics, then the command's result and timing are unchanged. (NFR-6)
- [ ] AC-21: Given a restart (simulated), then the values the design declares persistent are
  kept and the others show as unknown. (NFR-7)
- [ ] AC-22: Given widths from 320 px to desktop, portrait and landscape, then there are no page
  scrollbars; only a long tab content scrolls. (NFR-9)
- [ ] AC-23: AC-2, AC-5, AC-9 and AC-11 pass in the latest Chrome, Firefox, Safari and Edge.
  (NFR-10)
- [ ] AC-24: Tests for AC-2 to AC-5, AC-7, AC-8, AC-11, AC-12 and AC-20 run with simulated Groq
  answers and time, without a real call. (NFR-11)
- [ ] AC-25: Given the design, when a phase 2 group is added, then no existing group or the tab
  structure needs to change. (NFR-8)

## Assumptions

- The Czech Republic scope does not apply to this tab: the figures are about the AI service, not
  about places, so no request outside the country is involved.
- Recommendation "day, not session": the server has no concept of a user session (no accounts or
  cookies, spec 005 FR-15), and adding one would need identifiers for a diagnostic panel. "Day"
  matches the daily cap and Groq's daily request limit, needs no identifiers and survives a
  reload. The day is the UTC day, as for the cap. A per-visitor total can be computed in the
  browser later if wanted (not requested).
- All figures are app-wide and shared by all visitors (Groq's quota is shared, spec 005). The
  "last request" may therefore come from another visitor's command; only token counts are shown,
  no content. Accepted for a portfolio demo with low traffic.
- To draw a bar and show "remaining / limit" the limits are needed too; they come from the
  matching `x-ratelimit-limit-requests` and `x-ratelimit-limit-tokens` headers of the same
  answers (a small extension of the brief, same source).
- The cap's "37 / 500" counts requests the app admitted to the AI step (spec 005 FR-13); it can
  differ from the Groq request limit and from the Groq-side count; both are shown and labelled.
- "Within 15 s" for freshness is a conventional target that fits the 10 s cooldown; the
  architect may propose a tighter one.
- Duration formats of Groq reset headers are those in Groq's documentation (units d, h, m, s,
  ms, with decimals); anything else is "unknown".
- Seconds precision in countdowns is enough; the countdown starts from the server's receive time.
- Version bump follows the versioning policy; README is updated by the developer.
- The tab uses the panel structure of spec 008 (FR-3 there); control style as in the project's
  shared style constants.

## Open questions / risks

- For the architect: where counters live (restart, later more instances), the same question as
  for the daily cap; how data reaches the UI (polling or update after each request) within
  FR-12; whether bars use a UI-library component or SVG.
- Risk: public figures reveal when others use the app and how much quota is left; accepted for
  the demo, to be mentioned in the privacy notice TODO.
- Risk: Groq may change header names or formats; NFR-6 makes this degrade to "no data".
- Risk: the token limit renews continuously per minute, so the "remaining" figure is a snapshot
  of the last answer and ages fast (FR-7).
- Suggestion (not requested): a "last updated" time per group.
- Suggestion (not requested): a note in the tab that the free tier may also have a daily token
  limit on Groq's side, if the console shows one; the brief asks not to suggest it, so this is
  left out until the user confirms the real limits of the chosen model.
- Recommendation: **architect**. It extends the AI client contract, adds server state and a new
  read endpoint, and a UI data flow.
