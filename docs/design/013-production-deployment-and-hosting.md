# 013 – Production deployment and hosting (design)

- **Status:** Draft (decided by the owner; open owner TODOs below)
- **Date:** 2026-11-24
- **Spec:** [013 – Production deployment and hosting](../specs/013-production-deployment-and-hosting.md)
- **Next agent:** developer (T-1 to T-6; T-7 and T-8 are owner steps)

## Summary

One Wedos VPS: Node 26 as a systemd service on `127.0.0.1`, Caddy in front (Let's Encrypt for
`geogrind.cz`, sets `X-Real-IP`, no access log), state in `/var/lib/geogrind`. After CI passes on
`main`, GitHub Actions builds a standalone release and pipes it over SSH to a restricted deploy
user. The host switches a `current` symlink and health-checks it (automatic fall-back); a verify
script checks the public address. Rollback = flip the symlink back.

## Final decisions of the user

- **Host:** Wedos VPS ON: Ubuntu Server 24.04, 1 vCPU, 1 GB RAM, 10 GB SSD, 123.24 CZK/month
  incl. VAT (33 % discount, not guaranteed). Data centre Hluboká nad Vltavou (CZ).
- **Domain:** `geogrind.cz` at Wedos, 193.60 CZK incl. VAT (yearly rate, confirmed by the owner;
  about 16 CZK/month; the renewal is decided when it comes up). DuckDNS is dropped everywhere.
- **Address:** `https://geogrind.cz` (apex, canonical); `www` redirects to it if it exists; http
  redirects to https. The owner sets A (and AAAA if the VPS has IPv6) in the Wedos panel.
- **Total cost:** about 139.4 CZK/month. A higher renewal price of hosting or domain needs a new
  owner decision; nothing else paid is added (NFR-1).
- **Operator contact:** jakub.holecek31@gmail.com (also `GEOCODER_CONTACT`); `TERMS_VERSION` is
  bumped. The provider logs connection data incl. IPs, access logs at most 6 months (Wedos
  privacy documents, "Osobní údaje u WEDOS" v1.3, sections II and V).

**Open owner TODOs:** (1) manual approval of production deployments (default: automatic after CI
on `main`; a required reviewer on the `production` environment is available); (2) Wedos panel
checks in T-7 (the Ubuntu 24.04 LTS template is installed, confirmed by the owner; root SSH login works, confirmed by the owner): IPv4/IPv6 address, billing period, discount terms,
automatic renewal of the domain.

## Decisions

### D-1: Hosting – Wedos VPS (owner's decision)

| Option | Cost | Verdict |
|---|---|---|
| **Wedos VPS ON (1 vCPU, 1 GB, 10 GB)** | about 124 CZK/month | **Chosen by the owner**, CZ host |
| Forpsi VPS 1-1 (1 GB, 20 GB, CZ) | 90.75 CZK/month | Researched, not chosen |
| Oracle Cloud Always Free / Hetzner CX23 | 0 (card, idle reclaimed) / about 6 EUR | Not chosen |
| Render, Koyeb, Railway, Fly.io, Google e2-micro | sleeping, no volume or US-only | Out (FR-2, FR-6) |

Sources (checked 2026-11-24): Wedos/VEDOS VPS ON page (wedos.cz redirects to vedos.cz), the Wedos
privacy documents above, Forpsi VPS page, Hetzner Cloud page, Oracle Cloud Free Tier docs.
Unverified: traffic limit of VPS ON. Ubuntu 24.04 LTS is installed (confirmed by the owner). The panel firewall is not used;
`ufw` (IPv4 and IPv6) is.

**Disk budget (10 GB, estimates, checked in T-8):** Ubuntu 24.04 with updates 3.5 GB, swap 1 GB,
Node and Caddy 0.1 GB, 3 kept releases 0.4 GB, journald (14 days, capped) 0.2 GB, state plus room
for a later SQLite file 0.5 GB = about 5.7 GB, margin about 4.3 GB (over 40 %). Pruning (AC-27):
deploy keeps 3 releases, journald caps, unattended-upgrades cleans apt. Investigate above 70 %.

**Memory (1 GB):** Ubuntu 150 MB, Node 150-250 MB, Caddy 40 MB, sshd plus streamed unpack under
50 MB (nothing is built on the host): peak about 500 MB; 1 GB swap as safety net.

### D-2: Host software, address and DNS

Ubuntu 24.04 LTS; Node 26 (NodeSource apt, 26.13.1); Caddy 2.11.9 (apt); systemd; ufw
(`IPV6=yes`); unattended-upgrades; journald. Not Docker (RAM), nginx + certbot or PM2. Caddy
handles certificates (NFR-4) and has no access log unless configured (NFR-6). The Caddyfile
serves `geogrind.cz` and, only if a `www` record exists, redirects `www` to the apex; http
redirects to https. `APP_ORIGIN=https://geogrind.cz`. The records must resolve to the VPS before
the first deploy or the certificate request fails (T-7). A host move changes only the DNS records.

### D-3: Release artifact and trigger

`npm ci` and `npm run build` in CI with `output: "standalone"` switched on by an env flag (CI jobs
and `npm start` unchanged), plus `.next/static` and `public/release.json`, tarred, with CI's
placeholder `GROQ_API_KEY`; real values exist only on the host (AC-7). `deploy.yml` runs on
`workflow_run` of "CI" (completed, `main`, `push`, success) for `head_sha`; `environment:
production` (secrets limited to `main`); `concurrency` without cancelling; `workflow_dispatch`
redeploys `main`. Not a job in `ci.yml` (its `cancel-in-progress` could cancel a deploy), not a
self-hosted runner (FR-9, AC-15).

### D-4: Credentials

A `deploy` user whose `authorized_keys` entry has `restrict` and the forced command
`geogrind-deploy`; sudoers allows only `systemctl stop|start geogrind` and one extra command,
`geogrind-env-check`, run as the service user (prints variable names only, never values); the
deploy needs it to check the env file before the switch. Key and host key are
`production` environment secrets; no third-party actions. A leaked key can push a build but not
read the Groq key (`/etc/geogrind/geogrind.env`, root and service group) (NFR-3). Port 22 is
key-only, no root login, ufw rate limit (NFR-5).

### D-5: One instance, loopback only, stop-then-start

The service binds `127.0.0.1:3000`; only Caddy reaches it and it overwrites the header named in
`CLIENT_IP_HEADER` (`x-real-ip`) (FR-4). Activation stops the unit, flips the symlink and starts
it, so two processes never share the state (FR-6); seconds of downtime are accepted (NFR-2).

### D-6: Rollback, logs, running release

The host keeps 3 releases and a `previous` link; `geogrind-rollback` flips back and
health-checks. The state is never touched; a release that changes its shape stays readable by the
previous one (additive fields) or the release notes say "delete `state.json` before rollback"
(counters only, NFR-7). journald keeps service stdout (`[command]`, `[metrics]`, `[privacy]`),
deploy messages and sshd for 14 days (200 MB cap). Caddy's whole log is discarded (global
`log { output discard }`), so no visitor IP reaches the journal; certificate problems are debugged
by temporarily enabling it. No visitor IP is stored (FR-12, NFR-6). `/release.json` (`version`, `commit`, `builtAt`) tells which release runs.

### D-7: Terms host note

Names Wedos as VPS provider and the data centre (Hluboká nad Vltavou, CZ), states that Caddy keeps
no access log and the app stores only pseudonyms, and that the provider logs connection data incl.
IPs for at most 6 months. `OPERATOR_CONTACT` is the owner's e-mail; no DuckDNS wording;
`TERMS_VERSION` bumped (FR-13).

### D-8: Later database and second process (NFR-12, AC-23)

A `node:sqlite` file in `/var/lib/geogrind` behind `StateStore` fits the single instance and the
reserved 0.5 GB. A backend is a second systemd unit on another loopback port behind a second Caddy
site (about 150 MB RAM; swap covers peaks). Postgres is tight in 1 GB; a bigger plan costs more
than approved and needs an owner decision.

## Dependencies

No new npm packages. Host software, installed by hand in T-7: Node.js 26.x LTS (NodeSource, about
60 MB), Caddy 2.11.9 (apt, about 45 MB), ufw, unattended-upgrades, OpenSSH (distro).

## Components

| Component | Responsibility | Folder |
|---|---|---|
| Build switch, packaging, verify | standalone output, tarball, checks | `deploy/`, `next.config.ts` |
| Host templates and scripts | unit, Caddyfile, journald, sudoers, deploy/rollback | `deploy/host/` |
| Deploy workflow | gate, build, upload, verify | `.github/workflows/` |

## Data flow

1. Owner merges `develop` into `main`; CI passes; `deploy.yml` builds and streams
   `ssh deploy@host deploy <sha> < release.tgz`.
2. `geogrind-deploy` unpacks to `releases/<sha>` and runs the env check (names of missing
   variables only); on failure it aborts, the old release keeps running.
3. Stop, flip `current` (keep `previous`), start, poll `http://127.0.0.1:3000/cs`; on timeout flip
   back, restart the old release, exit non-zero. Prune to 3 releases.
4. The workflow runs `deploy/verify.sh https://geogrind.cz <sha>`. A failed verify leaves the
   release in place; the owner runs `sudo geogrind-rollback`.

## Interfaces

```
deploy <40-hex-sha>   # forced command; stdin = tarball; unpack, check, switch, health, prune
rollback              # switch to `previous`, health check; anything else is refused
```

```ts
// public/release.json
interface ReleaseInfo { version: string; commit: string; builtAt: string /* ISO 8601 */ }
```

Env (`/etc/geogrind/geogrind.env`, systemd `EnvironmentFile`, 0640): `GROQ_API_KEY`,
`GEOCODER_CONTACT`, `CLIENT_IP_HEADER=x-real-ip`, `APP_ORIGIN=https://geogrind.cz`,
`STATE_DIR=/var/lib/geogrind`; optional `GROQ_MODEL`, `GEOCODER_URL`, `DAILY_CAP`. Layout:
`/srv/geogrind/{releases/<sha>,current,previous}`; the state folder is 0700, outside every served
path (AC-12). GitHub `production` environment: secrets `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOST`;
variables `DEPLOY_HOST`, `PUBLIC_ORIGIN`; no Groq key.

`deploy/verify.sh <origin> <commit>` (needs `curl`; one line per check; never prints values):
1. http redirects to https, `www` to the apex if it resolves, `/` to `/cs` or `/en`; both return
   200 (AC-2, AC-3); `/release.json` commit equals `<commit>` (AC-15).
2. `/state.json`, `/.data/state.json`, unknown `/api/..` return 404 (AC-12).
3. `/api/metrics` same-origin returns 200; `POST /api/command` with a foreign `Origin` is
   rejected, the app's origin accepted (AC-10).
4. "Zoom to Prague" with `X-Real-IP: 203.0.113.1` finds a place (AC-14, one AI call); an immediate
   second command with `X-Real-IP: 203.0.113.2` is answered "too early", proving the header is
   overwritten (AC-8, no AI call).

## External services

| Service | Purpose | Free-tier limits | Key / config |
|---|---|---|---|
| Wedos VPS (1 vCPU, 1 GB, 10 GB, Ubuntu 24.04) | Host | paid: 123.24 CZK/month incl. VAT | owner account, SSH key |
| Wedos domain `geogrind.cz` and DNS | Address | paid: 193.60 CZK/year incl. VAT | A/AAAA (and `www`) in the Wedos panel |
| Let's Encrypt (via Caddy) | TLS certificate | free, auto-renewing | none |
| GitHub Actions | Gate, build, deploy | existing free usage | `production` environment secrets |

## Error handling

Missing variable -> deploy aborts before the switch (AC-6). Unhealthy release -> automatic
fall-back (FR-11). Crash or reboot -> `Restart=always` (FR-7). Certificate failure -> Caddy
retries, journal shows it (NFR-4). Corrupt state -> existing fail-safe (NFR-7).

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1, AC-1..4 | D-2, verify step 1, browsers in T-8 |
| FR-2..8, AC-5..14 | D-2, D-3, D-5, env file and check, verify steps 2-4; T-8 restart, reboot |
| FR-9..12, AC-15..19 | D-3, D-6, `verify.sh`; T-8 first release, rollback drill |
| FR-13, AC-20 | D-7, T-5 |
| FR-14, AC-28 | D-2, T-6, T-7 |
| NFR-1, AC-21 | final decisions, D-1, D-2 |
| NFR-5, AC-22 | D-2, ufw, T-7 |
| NFR-11, AC-24 | T-6, `deploy/host` templates |
| NFR-12, AC-23 | D-8 |
| NFR-2, NFR-8, NFR-13, AC-25..27 | D-1 budgets and pruning, T-8 `df`/`free`, load check |

## Implementation plan

**[owner]** = only the owner can do it (account, payment, secret, DNS).

1. **T-1: Standalone release build** - env-flag in `next.config.ts`, packaging with static files
   and `release.json`. Done when: the unpacked release runs with `node server.js` on Node 26 and
   serves `/`, `/cs`, `/api/metrics`; its size is reported; normal `build`/`start` and smoke tests
   are unchanged. Covers: FR-2, D-3.
2. **T-2: Host templates and scripts** in `deploy/host/` (hardened unit, Caddyfile with optional
   `www` redirect, journald caps, sudoers, `authorized_keys` line, deploy/rollback/env-check
   scripts); `.gitattributes` forcing LF for `*.sh`. Done when: scripts pass `shellcheck` and a dry
   run on Linux or WSL. Covers: FR-3, FR-4, FR-6, FR-7, FR-11, FR-12.
3. **T-3: `deploy/verify.sh`**. Done when: it runs against a local production server and fails
   with a clear line per failed check. Covers: FR-10, AC-17.
4. **T-4: `deploy.yml`** per D-3/D-4 (only checkout/setup-node, pinned like `ci.yml`). Done when:
   reviewed against the secrets list; a dry run without the SSH step builds the artifact.
   Covers: FR-9, NFR-3, AC-15.
5. **T-5: Terms** - host note in `messages/cs.json` and `en.json`, `OPERATOR_CONTACT` (fix its
   comment), bump `TERMS_VERSION`, change the `TermsTab` test from two `[TODO]` markers to none.
   Done when: tests pass, no `[TODO]` and no DuckDNS wording remain. Covers: FR-13, AC-20.
6. **T-6: Documentation** - `deploy/README.md` holds the runbook (prerequisites incl. DNS records
   and domain expiry reminder, host setup, release, verify, rollback, `apt upgrade`, logs, disk
   check); the main README gets a short "Production" section (release is fully automatic after
   merge to `main` and green CI) linking to it; `.env.example` hints, minor version bump (1.0.0 is the maintainer's). Done when: the owner can
   follow it alone. Covers: NFR-11, FR-14, AC-24, AC-26.
7. **T-7 [owner]: Provision once, following `deploy/README.md`** - (a) order `geogrind.cz` (consider
   automatic renewal) and the VPS; Wedos panel checks (TODO 2);
   (b) set A (AAAA if IPv6, `www` if used) to the VPS addresses and check propagation from outside
   (`dig`/`nslookup`) **before the first deploy**; (c) on the host: updates, swap, Node 26, Caddy,
   users, env file with the real Groq key, templates, ufw (22, 80, 443; IPv6 on),
   unattended-upgrades, key-only SSH; (d) deploy key with the forced command; (e) GitHub
   `production` environment (limit to `main`, optional reviewer: TODO 1), secrets, variables,
   branch protection requiring `checks` and `smoke`; (f) renewal reminders for domain and hosting.
   Done when: the records resolve to the VPS and the forced-command SSH login works.
8. **T-8 [owner + developer]: First release and acceptance** - merge `develop` into `main`
   (1.0.0), watch the workflow, run `verify.sh`; by hand: browsers, kill, reboot and redeploy keep
   the counters, rollback drill, logs, no raw IP in `state.json`, `free -m`/`df -h`, pruning after
   four deploys, DNS. Done when: AC-1, 9, 11, 13, 18, 19, 25-28 pass.

## Testing

Vitest: the updated `TermsTab` test (T-5). Scripts: shellcheck, dry run, `verify.sh` on a local
build. Other acceptance criteria are manual in T-8.

## Risks / open questions

- **Domain expiry:** an expired `geogrind.cz` takes the app offline and the name may be lost; the
  owner sets a reminder and, if offered, automatic renewal at Wedos (FR-14).
- **DNS propagation:** missing records make the first certificate fail and can delay a host move.
- **Renewal prices:** the domain price is the confirmed yearly rate (renewal decided when it comes up) and the hosting discount may end; a
  higher price needs a new owner decision (NFR-1). The owner also confirms the billing period
  (VPS ON annual billing, monthly +10 %).
- **Wedos panel unverified:** traffic limit (the Ubuntu 24.04 LTS template is installed and root SSH works).
- A shared data-centre IP may be rate-limited by Nominatim or Groq (verify step 4 shows it).
- Redirects behind the proxy must use the public host and https (verify step 1); the developer may
  need `X-Forwarded-*` handling. Unverified: `output: "standalone"` with next-intl and
  `instrumentation.ts` (T-1). NodeSource and Caddy need a monthly `apt upgrade` (`deploy/README.md`).
