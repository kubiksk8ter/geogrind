# 013 – Production deployment and hosting

- **Status:** Draft
- **Date:** 2026-11-24
- **Next agent:** architect

## Original request

Brief (branch chore/deployment, from develop; the first production release, version 1.0.0,
develop -> main, waits for this spec):

- Choose a hosting for production and deploy the app. The user prefers a VPS. GitHub offers no
  VPS; GitHub Actions already runs checks and smoke tests (`.github/workflows/ci.yml`) and
  deployment from GitHub (e.g. from main) is to be considered.
- All external services must be free of charge unless the user decides otherwise (see decided
  inputs below).
- Future requirement (not now, but the hosting must not rule it out): `data/state.json` (rate
  limit, cooldown, daily counters, tokens, results) will later be replaced by a small database
  behind the existing state store interface, with a Node or TypeScript backend.
- Facts from the code: long-running Node server (node >=26); state is a file in `STATE_DIR` with
  a lock (persistent writable disk, single instance); metrics window, pseudonym key and
  key-expiry timer live in the memory of one process; in production `CLIENT_IP_HEADER`,
  `APP_ORIGIN`, `GEOCODER_CONTACT` and `GROQ_API_KEY` are required; HTTPS is needed; the terms
  still contain `[TODO]` placeholders (operator contact, server host note); low traffic,
  portfolio demo.

Decided inputs (the owner's decisions, 2026-11-24):

- Hosting: Wedos VPS ON, Ubuntu Server 24.04 LTS installed, 1 vCPU, 1 GB RAM, 10 GB SSD,
  123.24 CZK per month incl. VAT. The 33 % discount is not guaranteed; the owner watches it.
- Domain: geogrind.cz at Wedos, 193.60 CZK per year incl. VAT (yearly rate confirmed; renewal
  is not dealt with now). Total about 139.4 CZK per month.
- Address: https://geogrind.cz (apex, canonical); www redirects to it if it exists.
- Operator contact: the owner's e-mail jakub.holecek31@gmail.com (also for `GEOCODER_CONTACT`).
  `TERMS_VERSION` is bumped when the host note is filled in.
- Data centre: Hluboká nad Vltavou (CZ); data and compute are not moved or replicated abroad.
  The provider logs network and connection data (IP addresses, data flows, DDoS/IDS records)
  and keeps access logs for at most 6 months (Wedos privacy documents). Both go into the host
  note of the terms.
- Docker is not used now; revisit when the database exists.
- Release trigger (automatic or manual) is left to the design.

## Goal

Run GeoGrind in production at https://geogrind.cz so that visitors can use the demo and the
first release (1.0.0) can be published. The hosting must fit the way the app stores state and
identifies clients, respect the approved cost and the limits of the ordered server, and be
updated and rolled back in a repeatable way.

## Scope

### In scope

- Requirements for the production hosting and its surroundings (runtime, disk, proxy, HTTPS,
  address, outbound access, configuration and secrets).
- How a release reaches production and how it is rolled back.
- What the owner can see after a deployment (logs, running version) and what must work.
- The dependency on the terms texts (host note, operator contact).
- Documentation of the production setup for the owner.

### Out of scope

- Choosing the provider, plan, operating system or domain (decided, see NFR-1 and NFR-13).
  Choosing the reverse proxy, process supervision, certificate tooling and deployment tool is
  the architect's task.
- Replacing the state file with a database and a separate backend (outlook only, NFR-12).
- Several instances, load balancing, horizontal scaling, a CDN.
- Application features, changes of limits, texts other than the host note and operator contact,
  new map layers or routing.
- Backups of the state file (only counters and short-lived pseudonymised records).
- Monitoring, alerting and uptime services (see suggestions).
- Legal review of the terms (spec 012).
- E-mail addresses or mail hosting on geogrind.cz.

## User stories

- As a visitor, I want to open the demo at a stable HTTPS address and use it as in development,
  so that I can try it without installing anything.
- As the owner, I want the setup to stay within the approved monthly cost, so that I decide
  myself if the price changes.
- As the owner, I want to release the app from GitHub in a repeatable way, so that production
  always runs a version that passed the checks.
- As the owner, I want to return quickly to the previous release if a release is broken.
- As the owner, I want secrets and visitors' IP addresses protected, so that the demo meets the
  promises in the terms.
- As the owner, I want to see what the running server reports, so that I can find out why
  something does not work.

## Functional requirements

- FR-1 Public availability: the app is reachable by anyone at https://geogrind.cz (apex,
  canonical). Opening it redirects to the Czech or English version as in spec 001, and the map,
  command input, side panel, language switch and start-up notice work as in development. Plain
  HTTP redirects to HTTPS; www.geogrind.cz, if it exists, redirects to https://geogrind.cz.
  Visitors are not blocked by location; commands from outside the Czech Republic are handled as
  today (spec 005).
- FR-2 Runtime: the app runs as a long-running server process on the Node version the project
  requires. Static-only hosting and platforms that start the app per request do not satisfy
  this. Exactly one instance serves the app at any time.
- FR-3 Production configuration: all variables required in production (`GROQ_API_KEY`,
  `GEOCODER_CONTACT`, `CLIENT_IP_HEADER`, `APP_ORIGIN`) are supplied to the running server and
  the optional ones (`GROQ_MODEL`, `GEOCODER_URL`, `STATE_DIR`, `DAILY_CAP`) can be set. Values
  are not stored in the repository, build output or browser bundle. `GROQ_API_KEY` is not
  written to any log, including deployment logs.
- FR-4 Trusted client address: a reverse proxy in front of the app sets the header named in
  `CLIENT_IP_HEADER` to the real client address on every request, overwriting any client-sent
  value. The app cannot be reached from the internet bypassing this proxy.
- FR-5 Origin: `APP_ORIGIN` equals exactly https://geogrind.cz, so that the same-origin checks
  of the command and metrics endpoints accept the app's own pages and reject others.
- FR-6 Persistent state: `STATE_DIR` is on a writable disk that keeps its content across
  restarts, redeployments and reboots. Two instances never use the state at the same time
  during a redeployment. The folder is not reachable from the web.
- FR-7 Supervision and restart: if the process stops or the host reboots, the app starts again
  on its own. After a restart the in-memory data (metrics window, last AI figures, Nominatim
  status, pseudonym key) is empty and the start-up cleanup of the previous run's client records
  runs. This is intended (specs 009 to 011), not a failure.
- FR-8 Outbound access: the server can reach the AI provider and the geocoder over HTTPS.
  Visitors' browsers can reach the map style and tile service directly.
- FR-9 Release trigger: a release is the update of main with the tested state of develop; the
  first is version 1.0.0. It is deployed only if the existing checks (lint, typecheck, tests,
  build, smoke tests) passed for that state. The procedure is documented and repeatable by the
  owner alone. Whether deployment starts automatically from GitHub or by hand is decided in the
  design; either way the owner can tell which release is running.
- FR-10 Verification after deployment: a documented way confirms that the app is up and
  correctly configured, including that a command reaches the AI and the geocoder, without
  noticeably using the daily AI cap.
- FR-11 Rollback: the owner can return to the previous release by a documented procedure
  without losing or repairing the state file. A broken release does not corrupt the state in a
  way that stops the previous release from starting.
- FR-12 Logs and diagnostics: the owner can read the server's output (`[command]`, `[metrics]`
  and `[privacy]` lines) and the start-up and deployment messages for at least the last 7 days
  and can tell whether the process is running. Logs contain no secrets and no raw IP addresses
  (spec 011).
- FR-13 Terms dependency: before the first release, the operator contact and the server host
  note in the terms (spec 012) are filled in with true values and no `[TODO]` is left in the
  Czech or English terms. The contact is jakub.holecek31@gmail.com. The host note names the
  host and its data-centre location and states whether the host, the provider and the reverse
  proxy log IP addresses and for how long. `TERMS_VERSION` is raised.
- FR-14 Domain and DNS: geogrind.cz is registered at the provider and its DNS records are
  managed there by the owner: an A record and, if the server has IPv6, an AAAA record point to
  the VPS addresses (plus a record for www, if used). The domain stays valid while the app runs;
  watching the renewal is an owner task. The records are described in the documentation.

## Non-functional requirements

- NFR-1 Cost (decided): hosting 123.24 CZK per month incl. VAT (discount expected to stay, not
  guaranteed) plus the domain at 193.60 CZK per year incl. VAT (about 16 CZK per month), about
  139.4 CZK per month in total. Everything else is free of charge (certificate, deployment
  tooling); a free tier needing an account is fine. A price increase (end of the discount,
  renewal) needs a new owner decision; the architect must not rely on a higher price or add any
  further paid option.
- NFR-2 Availability: best effort, no uptime guarantee. An interruption of a few minutes during
  a deployment or restart is acceptable. An unplanned crash is recovered automatically (FR-7).
- NFR-3 Security of secrets: the Groq key and any deployment credentials are visible only to the
  owner and the running server, stored in the platform's secret mechanism or a file readable
  only by the server's account, with least privilege. The key is not reachable through any web
  path or in the browser bundle.
- NFR-4 Transport security: all traffic to geogrind.cz (and www, if it exists) uses HTTPS with a
  valid, self-renewing certificate for that name. Plain HTTP is used only to redirect.
- NFR-5 Host hygiene: the runtime and operating system receive security updates and only the
  ports the app needs are open. The host is self-managed by the owner.
- NFR-6 Privacy: the deployment does not weaken spec 011. Proxy and host logs, if any, keep IP
  addresses no longer than needed, and the terms state truthfully what they keep (FR-13). The
  hosting adds no analytics or tracking.
- NFR-7 Persistence: the state survives restarts and redeployments (FR-6). No backup is
  required, but a loss must not leave the app unable to start (the existing fail-safe handling
  of a corrupt or missing file is kept).
- NFR-8 Performance: for a few simultaneous visitors a command takes as long as in a local
  production run plus network latency; visitors in the Czech Republic get reasonable latency.
- NFR-9 Localisation: every user-visible text added by this work (host note, operator contact,
  any error or maintenance page shown by the proxy when the app is not running) exists in Czech
  and English.
- NFR-10 Browsers: unchanged; the latest Chrome, Firefox, Safari and Edge.
- NFR-11 Reproducibility: the repository documentation describes the setup well enough for the
  owner to recreate it on a new host without the old host's state. It contains no secrets.
- NFR-12 Outlook (not implemented now): the choice must not prevent a later replacement of the
  state file by a small database behind the state store interface, with a Node or TypeScript
  backend. The ordered server must be able to take a database (small file or service) and/or a
  second long-running process later, within NFR-13, without changing provider. The
  single-instance rule may be relaxed by that later work, not by this one.
- NFR-13 Fixed server limits (hard): Ubuntu Server 24.04, 1 vCPU, 1 GB RAM, 10 GB SSD. The 10 GB
  must hold the operating system and updates, any swap, runtime, the current and previous
  release (for rollback), state, logs with retention (FR-12) and room for a later database file
  (NFR-12), with a safety margin so the disk never fills up. The 1 GB RAM (shared by app, proxy
  and anything else) must suffice for normal operation and a deployment; if building on the
  server does not fit, the design avoids it.

## Acceptance criteria

- [ ] AC-1: Given the deployed app, when https://geogrind.cz is opened in the latest Chrome,
  Firefox, Safari and Edge, then the map loads, the start-up notice is shown, a zoom command
  moves the map, and the side panel and language switch work. (FR-1, NFR-10)
- [ ] AC-2: Given http://geogrind.cz, when requested, then it redirects to https://geogrind.cz;
  the certificate is valid and renews without manual action. If www.geogrind.cz exists, its
  HTTP and HTTPS requests end at https://geogrind.cz with a valid certificate. (FR-1, NFR-4)
- [ ] AC-3: Given https://geogrind.cz without a language, when opened, then it redirects to
  `/cs` or `/en` as before. (FR-1)
- [ ] AC-4: Given a visitor from outside the Czech Republic, when they open the app and send a
  command, then it is handled as today and not blocked by the hosting. (FR-1)
- [ ] AC-5: Given the running production server, then it runs on the required Node version as
  one process and no second instance uses the same state. (FR-2, FR-6)
- [ ] AC-6: Given a deployment without one of the required variables, when verified, then the
  check fails and names the missing variable without printing any value. Given all variables,
  the check passes. (FR-3, FR-10)
- [ ] AC-7: Given the repository, build output, browser bundle and deployment logs, then the
  Groq key appears in none of them. (FR-3, NFR-3)
- [ ] AC-8: Given a request that carries its own value in the `CLIENT_IP_HEADER` header, when it
  passes the proxy, then the app sees the real client address; and the app's own port is not
  reachable from the internet directly. (FR-4)
- [ ] AC-9: Given the 11th command within a minute from one real address, then it is limited as
  in development; and the stored state after commands contains no raw IP address. (FR-4, NFR-6)
- [ ] AC-10: Given `APP_ORIGIN` equals https://geogrind.cz, when a command request has an
  `Origin` other than https://geogrind.cz, then it is rejected; from the app's own pages it is
  accepted. The same holds for the metrics endpoint. (FR-5)
- [ ] AC-11: Given commands that changed the state, when the process is restarted, the host is
  rebooted and a new release is deployed, then the day's counters are still there after each.
  (FR-6, NFR-7)
- [ ] AC-12: Given the state folder, then it cannot be fetched through any web address. (FR-6)
- [ ] AC-13: Given the server process is killed, then it runs again without manual action, and
  afterwards the metrics window and last AI figures are empty while the day's counters are kept.
  After a host reboot the same is true. (FR-7)
- [ ] AC-14: Given the deployed app, when a command is sent, then the AI provider and the
  geocoder are reached and a place is found; and map tiles load in the visitor's browser.
  (FR-8)
- [ ] AC-15: Given a state of develop whose checks failed, then it is not deployed; given a
  passing state merged into main, then it is deployed by the documented procedure and the owner
  can tell which release (version or commit) is running. (FR-9)
- [ ] AC-16: Given the first release, then the version is 1.0.0 and the procedure was carried
  out from the documentation alone. (FR-9, NFR-11)
- [ ] AC-17: Given a finished deployment, when the documented verification is run, then it
  confirms the page, the configuration and one real command, using at most a few AI calls of
  the daily cap. (FR-10)
- [ ] AC-18: Given a broken release, when the documented rollback is performed, then the
  previous release serves visitors again, the state file is intact and the previous release
  starts without repair. (FR-11)
- [ ] AC-19: Given the production host, then the owner can read the log lines of the last 7 days
  and see whether the process is running; the lines contain no secret and no raw IP address.
  (FR-12, NFR-6)
- [ ] AC-20: Given the Czech and English Terms tab in production, then neither contains
  `[TODO]`; the operator contact is jakub.holecek31@gmail.com; the host note names the host and
  its data-centre location and states truthfully what the host, provider and proxy log; and the
  terms version is higher than before. (FR-13, NFR-9)
- [ ] AC-21: Given the whole setup, then the only recurring costs are the VPS at 123.24 CZK per
  month incl. VAT and the domain at 193.60 CZK per year incl. VAT (about 139.4 CZK per month in
  total); certificate and deployment are free. Given a higher price at renewal of the hosting
  or domain, then the owner has made a new decision before it is accepted. (NFR-1)
- [ ] AC-22: Given the production setup, then the runtime and operating system can be updated
  and only the needed ports are open. (NFR-5)
- [ ] AC-23: Given the design, then it states how a database and a second long-running process
  could be added later on the same server within NFR-13. (NFR-12)
- [ ] AC-24: Given the repository documentation, then it describes the production prerequisites
  (including the DNS records of geogrind.cz), the deployment, the verification and the rollback
  without any secret. (NFR-11, FR-14)
- [ ] AC-25: Given a few simultaneous visitors, then commands complete without host-caused
  errors (timeouts, out-of-memory) and the page loads without noticeable delay for the Czech
  Republic. (NFR-2, NFR-8)
- [ ] AC-26: Given the design, then it contains a disk budget on the 10 GB SSD (operating
  system, swap, runtime, current and previous release, state, logs with retention, room for a
  later database file) with a stated safety margin, and a memory budget on 1 GB RAM covering
  normal operation and a deployment. (NFR-13)
- [ ] AC-27: Given the server after several deployments and a week of logs, then the disk is not
  filling beyond the stated margin: old releases and logs are pruned by a documented automatic
  rule. (NFR-13, FR-12)
- [ ] AC-28: Given the DNS of geogrind.cz, when resolved, then the A record (and AAAA, if the
  server has IPv6) point to the VPS addresses; and the documentation names the registration
  expiry as an owner task with a renewal reminder. (FR-14)

## Assumptions

- Czech Republic scope: the app is public worldwide and not geo-blocked. Behaviour for requests
  and places outside the country is unchanged (spec 005).
- Availability is best effort, as in the terms ("as is"). A deployment may interrupt the
  service for a few minutes.
- "At least 7 days" of logs is the analyst's default; the architect may propose another period
  as long as FR-12 and NFR-13 hold.
- The production branch is `main`, receiving releases of `develop` (CLAUDE.md). The bump to
  1.0.0 belongs to the maintainer at release.
- "Reverse proxy" means any component in front of the app that terminates HTTPS and sets the
  trusted header; which program is the architect's decision.
- The operator contact is the owner's personal e-mail (publicly visible on GitHub for a long
  time without problems); it now becomes part of the public repository.
- `APP_ORIGIN` holds only https://geogrind.cz; www, if it exists, only redirects.
- The domain and the VPS are both at Wedos and the owner edits the DNS records there, so no
  third-party DNS service is needed.
- No backup of the state file is needed (NFR-7).
- The checks and smoke tests in `.github/workflows/ci.yml` are reused as the release gate and
  are not changed by this spec.
- The deployment documentation goes into the README and the architecture document, updated by
  the developer and the architect in their roles.

## Open questions / risks

- Open: manual approval of production deployments. Automatic deployment after a merge to main
  is preferred if free and without broad credentials; the owner may still want a manual
  approval step.
- Open: Wedos panel checks still to be done by the owner: the server's IPv4 and IPv6 addresses
  (for FR-14), the billing period, the discount terms and the traffic limit.
- Risk: the 10 GB disk is limited (NFR-13). A default Ubuntu install, updates, runtime, two
  releases, logs and swap use roughly half of it. The design must budget it and prune
  automatically.
- Risk: 1 GB RAM may not suffice to build the app on the server; the design must not depend on
  it (NFR-13).
- Risk: Node 26 or newer is probably not in the standard Ubuntu 24.04 packages; installing and
  updating it is the architect's task.
- Risk: a shared data-centre address may be rate-limited or blocked by the public geocoder or
  the AI provider. The geocoder's 1 request per second rule applies to the whole app.
- Risk: the proxy or host usually logs IP addresses by default. The real behaviour must be known
  and stated in the host note (FR-13); long raw-IP logs would weaken spec 011.
- Risk: an existing unit test expects exactly two `[TODO]` markers in the terms; when FR-13 is
  done the developer must update it to expect none.
- Risk: deployment credentials of an automatic deployment are a new secret; they belong in the
  repository's secret store with least privilege (NFR-3).
- Risk: a self-managed server is the owner's responsibility (NFR-5). An expired domain would
  take the app offline and could lose the address (FR-14). DNS changes can take time to spread,
  which matters for the first certificate and for a move to a new server.
- Suggestions (not requested): a read-only health check address for verification and a free
  uptime monitor; security response headers; the production address in the README; a
  maintenance page in both languages; backing up `STATE_DIR` once the database makes the data
  more valuable; automatic domain renewal at the provider, if offered.
- Follow-up: the later database and backend (NFR-12) need their own spec.
- Recommendation: **architect**. The work adds a reverse proxy, process supervision, a
  deployment pipeline with secrets, a disk and memory budget on a small server and a rollback
  procedure, and touches configuration, persistence and privacy in several parts of the app.
