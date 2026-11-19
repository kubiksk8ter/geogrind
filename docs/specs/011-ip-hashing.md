# 011 – Hashing of client IP addresses with a daily rotating key

- **Status:** Draft
- **Date:** 2026-11-18
- **Next agent:** architect

## Original request

Brief for the analyst (translated from Czech; step 1 before going to production, GDPR):

Client IP addresses must be hashed before they are stored on the server. The key for the hash is
discarded every 24 h and a new one is generated.

Findings about the current code given with the brief:

- The server state file stores the raw client identifier (an IPv4 address or the /64 prefix of an
  IPv6 address) as the key of every client record (hits, cooldown, in-flight mark). Records are
  removed after the 60 s rate-limit window and the 10 s cooldown expire, but until then the raw IP
  lies on disk.
- The application metrics window already hashes client identifiers with a keyed hash (HMAC-SHA-256)
  whose random key lives only in process memory. It is the only place that hashes.
- Logs and metrics contain no IPs (specs 009, 010).
- Hosting: one instance, one process (spec 005); modules may be duplicated in bundles, so shared
  instances live on `globalThis`.

Preliminary proposal from the brief (to verify, complete, challenge): one shared module with a
rotating key used by both the limits and the metrics window; key in process memory only, never on
disk; rotation after 24 h (possibly aligned to UTC midnight like the daily cap), generated lazily;
hash applied right after the client id is resolved, before anything is written to the state file;
rate-limit rules unchanged; old hashes cleaned after rotation; plain SHA-256 is not enough (IPv4
has only 2^32 values), hence a keyed hash; rotation briefly resets rate limit/cooldown for all
clients (records live <= 60 s), acceptable for a demo; testable with an injectable clock and key
generator; legally, while the key exists this is pseudonymisation, so the later terms must say
"hashed with a key rotated every 24 h and automatically deleted after the time limit", not "we do
not store IPs". Intended wording for the terms: "to protect the service against overload and
abuse of AI features, you temporarily process IP addresses on the basis of legitimate interest and
automatically delete them after the time limit".

Scope per the brief: only IP hashing and key rotation. Out of scope: terms of use (step 2), tests,
smoke tests and GitHub CI (step 3). The recommendation must say whether the developer alone is enough or the architect is
needed.

No clarifying questions were needed; defaults are listed under *Assumptions*.

## Goal

Make sure that no raw client IP address is ever stored on the server, so that the demo can run in
production with data protection (GDPR) in mind. Rate limiting, cooldown and the usage figures must
keep working for the visitor exactly as before.

## Scope

### In scope

- Replacing the raw client identifier by a keyed hash everywhere the server stores or keeps it
  beyond the processing of one request: the persistent state file and the in-memory metrics
  window.
- A secret key that exists only in the memory of the running server and is replaced by a new
  one at the latest every 24 h; the old key is then destroyed.
- Removal of stored hashes that can no longer be matched, and of raw identifiers left by earlier
  versions.
- Recording the effect of the rotation on limits as an accepted behaviour.

### Out of scope

- Terms of use and privacy notice texts (step 2, a separate later spec; see Assumptions for the
  wording to carry over).
- Automated tests, smoke tests and CI (step 3). This does not relax NFR-6 (testability of the
  design).
- Any change to the values of the rate limit, cooldown, in-flight rule, daily cap or to the
  visible behaviour and texts of the app.
- Hashing or removing the IP in infrastructure outside the app (hosting provider's logs, reverse
  proxy). See risks.
- Changes to what the metrics show (specs 009, 010).

## User stories

- As a visitor, I want my IP address not to be stored in readable form so that my privacy is
  protected while I use the demo.
- As the owner of the demo, I want a hash key that is destroyed every day and never written to
  disk so that stored values cannot be linked back to an IP address or to a person after that.
- As the owner, I want limits and metrics to work as before so that protection of the service is
  not weakened.

## Functional requirements

- FR-1 Hash before storage: a client identifier (as already derived from the request: IPv4
  address or the /64 prefix of an IPv6 address) is converted into a keyed hash right after it is
  resolved. Only the hash is used from then on by the limits, the state file, the metrics window
  and anything that follows. The raw identifier is not stored, logged, put into an error message
  or passed on after this step.
- FR-2 Keyed, not plain: the hash must not be computable or reversible without a secret key
  (a plain unkeyed hash is not acceptable because the space of IPv4 addresses can be enumerated).
  The same identifier gives the same hash while the same key is valid, so the rules (rate limit,
  cooldown, in-flight mark, active clients) keep working as before.
- FR-3 Key in memory only: the key is never written to disk, to the state file, to logs, to
  metrics, to responses or to any external service. It is generated randomly by the server when
  first needed. After a restart a new key is generated, and hashes made with an older key can no
  longer be matched to any client.
- FR-4 Rotation: a key is valid for at most 24 h. When it expires, the server discards it and uses
  a new random key for the next request. The new key is independent of the old one. The old key is
  not kept anywhere after rotation. Rotation happens without a restart and without any visible
  effect for the visitor other than FR-6.
- FR-5 One key for all: the limits and the metrics window use the same key and the same hash of a
  client within one validity period, so a client has a single pseudonym in the app. The window
  does not hash a second time and does not keep its own separate key.
- FR-6 Effect of rotation (accepted): after rotation the records of earlier hashes do not match
  any client, so rate-limit counters, cooldown and in-flight marks of all clients start empty. The
  daily cap and the count of AI calls (which are not per client) are not affected. This is recorded
  as accepted behaviour.
- FR-7 Cleanup: stored client records made with a key that is no longer valid are removed no
  later than the next time the state is changed after rotation or restart, and records that expired
  by the existing rules are still removed as today. Records of earlier versions that hold a raw
  identifier are removed on the first state change after the update goes live and are never
  matched, never used for limits and never re-saved.
- FR-8 Unchanged rules: limits, cooldown, in-flight rule, daily cap, error codes and responses are
  unchanged. A request for which no client identifier can be derived is handled as today and no
  placeholder identifier is hashed or stored.
- FR-9 Metrics unchanged: the figures and the access rules of specs 009 and 010 are unchanged;
  active clients are still counted without being identifiable (spec 010 FR-6, FR-14). A client
  whose key changed during the last hour may be counted twice in that hour (see risks).

## Non-functional requirements

- NFR-1 Cost: no new paid service, no extra calls to any external service.
- NFR-2 Localisation: the change adds no user-visible text. If any text is added during design, it
  must exist in Czech and English.
- NFR-3 Privacy: after the change, a copy of the state file and of the logs contains no raw IP
  address or any value from which it could be derived without the key that exists only in the
  memory of the running server. Hashing must not use a fixed or guessable key, and the key must
  not be derivable from anything stored.
- NFR-4 Security: key generation uses a cryptographically secure source of randomness; the key
  has strength appropriate for a keyed hash of at least 256 bits; the key and raw identifiers are
  not exposed through errors.
- NFR-5 Robustness: a failure to hash or to rotate must never fall back to storing the raw
  identifier. It fails the request in the existing `error` way. The cost of hashing and rotation
  is negligible next to a command.
- NFR-6 Testability: the clock and the key generation can be replaced in tests, so that rotation,
  the expiry boundary, restart and cleanup can be verified with simulated time. Writing the tests
  is a later step (see out of scope).
- NFR-7 Single instance: the design relies on one running server process (spec 005). Several
  instances sharing one state file are not supported and would not match each other's hashes.
- NFR-8 Browsers: no effect on the browser side; the latest Chrome, Firefox, Safari and Edge are
  supported as before.
- NFR-9 Extensibility: a later error log (`.data/logs.json`, see spec 010) must not need raw
  identifiers; the hash is available to it if ever needed and the key rule (FR-3) still holds.

## Acceptance criteria

- [ ] AC-1: Given a command from a known test IP (IPv4 and IPv6), when the state file is
  inspected after the request, then the IP, and its /64 prefix for IPv6, appear nowhere in it,
  only a hash is used as the client key. (FR-1, NFR-3)
- [ ] AC-2: Given a command, then the IP does not appear in the state file, the metrics window,
  the metrics answer, the logs or any error message, including the case of a failed command.
  (FR-1, NFR-3, NFR-5)
- [ ] AC-3: Given two requests from the same IP within one key period, then they are matched to
  the same client: the eleventh request in a minute is limited, the cooldown and in-flight rules
  apply as before. Given two different IPs, then they are different clients. (FR-2, FR-8)
- [ ] AC-4: Given the stored hash and the same IP, then the hash cannot be reproduced by an
  unkeyed hash of the IP (for example plain SHA-256). (FR-2)
- [ ] AC-5: Given a running server, then the key does not appear in the state file, logs,
  responses or metrics, and there is no file with the key on disk. (FR-3)
- [ ] AC-6: Given a restart (simulated), then the next request from the same IP gets a different
  hash than before, and records stored before the restart do not match it. (FR-3)
- [ ] AC-7: Given 24 h pass since the key was created (simulated), then the next request gets a
  new hash for the same IP; just before 24 h the old hash is still used. A key created after a
  restart is replaced at the latest 24 h after its creation. (FR-4)
- [ ] AC-8: Given a rotation, then the old key is no longer held by the server and the new key is
  not derivable from it; two consecutive keys differ. (FR-4, NFR-4)
- [ ] AC-9: Given a request, then the limits and the metrics window store the same hash for it,
  and the window does not compute another one. (FR-5)
- [ ] AC-10: Given a client at the rate limit or in cooldown when the key rotates, then the next
  request is treated as from a new client (counters empty), while the daily cap and the AI-call
  count are unchanged. (FR-6)
- [ ] AC-11: Given records made with an expired key, then they are removed from the state file at
  the latest at the next state change; given an idle server, no new raw or key-linked data is
  written. (FR-7)
- [ ] AC-12: Given a state file from an earlier version with raw identifiers, when the first
  request after the update is processed, then no raw identifier remains in the file and none is
  used for limits. (FR-7)
- [ ] AC-13: Given the existing behaviour (limit values, cooldown, cap, error codes, texts), then
  nothing visible changes for the visitor except FR-6. A request without a derivable client
  identifier behaves as today and stores nothing about the client. (FR-8)
- [ ] AC-14: Given the metrics tab, then the figures and the access rules are unchanged and active
  clients are shown as a count only. (FR-9)
- [ ] AC-15: Given a simulated failure of hashing or key generation, then the request ends with
  the existing `error` result and no raw identifier is stored or logged. (NFR-5)
- [ ] AC-16: Given the design, then the clock and the key generation can be replaced in tests.
  (NFR-6)
- [ ] AC-17: Given the whole change, then no new paid service or external call is introduced.
  (NFR-1)

## Assumptions

- The Czech Republic scope does not apply to this internal change; requests from outside the
  country are handled as before. Clients are identified in the same way as now.
- Rotation is "at the latest 24 h after the key was created", and the key is also replaced at the
  next UTC midnight, whichever is first (user proposal; the same day boundary as the daily cap).
  Whether the key lives exactly 24 h or ends at midnight is the architect's decision, as long as
  no key lives longer than 24 h. (Midnight alignment is predictable for an abuser, the effect of
  which is bounded by the daily cap; see risks.)
- The key is generated lazily at the first request and not at start-up. After a restart the old
  key is lost on purpose.
- The accepted effect of rotation (FR-6) is a short reset of rate-limit counters for all clients
  (their records live at most 60 s); it is accepted for a demo of low traffic. It is a weakening
  of rate limiting only at the moment of rotation; the AI cost is still protected by the daily
  cap.
- Hash length and format (how much of the digest is kept) are the architect's decision, as long as
  FR-2 and NFR-3 hold.
- Legally, while the key exists the hash is pseudonymised data, not anonymous. The terms of use
  (step 2, a separate later spec) must therefore say that IP addresses are hashed with a key
  rotated every 24 h and automatically deleted after the time limit, and not that IPs are not
  stored. The intended wording is: "to protect the service against overload and abuse of AI
  features, you temporarily process IP addresses on the basis of legitimate interest and
  automatically delete them after the time limit". This spec only requires the code behaviour;
  the texts follow in step 2 (Czech and English).
- README and any description of what is stored are updated by the developer.
- The state file keeps its other content (daily counts, tokens, AI block); only the client keys
  change.

## Open questions / risks

- Risk: until the key is discarded, the hash is pseudonymised personal data (see Assumptions);
  this is not an anonymisation and the privacy texts must not claim it is.
- Risk: the IP is still present in process memory during one request and may be seen by the
  hosting provider's infrastructure (proxy, platform logs). It is outside the app's control; step 2
  should state the processing honestly.
- Risk: a key period shorter than the one-hour metrics window means a client may be counted twice
  in "active clients" for up to an hour after rotation. Accepted; the figure is approximate.
- Risk: a predictable rotation at UTC midnight lets an abuser double a burst of requests across
  the boundary. Bounded by the daily cap and by the low traffic of the demo; the architect may
  prefer a rotation not aligned to midnight.
- Risk: an idle server leaves the last client records in the state file until the next request or
  restart; they contain only hashes of a key that is destroyed at rotation. The architect decides
  whether a cleanup without traffic is worth it (suggestion, not requested).
- Suggestion (not requested): the length of the stored hash could be kept short (as the metrics
  window does with 16 characters), to keep a pseudonym less unique.
- Follow-up: step 2 (terms of use and privacy notice, Czech and English) and step 3 (tests, smoke
  tests, CI); see the memory item on the privacy notice.
- Recommendation: **architect**. Although the idea is small, it adds a new shared module with its
  own time-based state, touches several parts (limits, state file and its old data, metrics window,
  the command handler) and changes how the stored data is shaped, including how old records are
  migrated and how a restart and rotation interact with a persistent file.
