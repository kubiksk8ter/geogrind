# 011 – Hashing of client IP addresses with a daily rotating key (design)

- **Status:** Draft
- **Date:** 2026-11-18
- **Spec:** [011 – Hashing of client IP addresses with a daily rotating key](../specs/011-ip-hashing.md)
- **Next agent:** developer

## Summary

A new server module `src/server/privacy/` owns an in-memory keyring. The command handler turns the
resolved client id into a pseudonym (`<keyId>~<HMAC-SHA-256 prefix>`) right after resolving it;
limits, state file and metrics window only ever see the pseudonym. The key lives until the next UTC
midnight. Stale pseudonyms and legacy raw ids are removed by a decorator around the `StateStore`
(on every write and every read). An unref'd expiry timer (armed when a key is created; a second
unref'd timer only retries a failed sweep) and a sweep at server start (`instrumentation.ts`)
destroy the key and clean the file even without traffic.

## Decisions

### D-1: Keyed hash, stored shape

- **Choice:** client id = `${keyId}~${digest}`. `digest` = first 16 chars (96 bits) of
  base64url(HMAC-SHA-256(key, rawId)); `key` = 32 random bytes; `keyId` = 8 chars of base64url of
  6 *separately drawn* random bytes (public label of the key period, not derived from the key).
- **Why the prefix:** it tells the cleanup which records belong to the current key without
  touching the state schema (`clients` stays `Record<string, ...>`). Raw ids (`1.2.3.4`,
  `2001:db8::/64`) can never match the strict format `^[A-Za-z0-9_-]{8}~[A-Za-z0-9_-]{16}$`, so
  legacy records are recognised by format alone. A `keyId` is random, not a counter, because a
  counter restarts at 0 and would collide with ids left on disk by a previous process.
- **Alternatives:** plain SHA-256 (enumerable, FR-2); a top-level `keyId` field in the state file
  (schema change, and `addResult`/`addTokens` rules would need it); full 256-bit digest (longer
  and more unique pseudonym than needed; the spec suggests short).

### D-2: Rotation at UTC midnight (owner decision, closed)

A key expires at the next UTC midnight after its creation, which is always within 24 h
(`nextUtcMidnight` from `state/rules.ts`), so "at most 24 h" (FR-4) holds by construction.
Rationale of the owner: a predictable boundary gives an abuser nothing extra, because the daily cap
resets at the same moment; an unaligned rotation would only add complexity. Consequence for tests:
AC-7 is verified at the midnight boundary (allowed by the spec's Assumptions).

### D-3: Key in memory only, one shared keyring

`ClientKeyring` is a `globalThis` singleton (bundles may duplicate the module; same pattern as
`geogrindCommandWindow`). The key is never written anywhere; on discard the buffer is zero-filled
and the reference dropped (best effort in JS). The keyring is created lazily on the first
`pseudonymize` call. Its only randomness and time sources are injected (NFR-6).

### D-4: Where the hash is applied

In `commandHandler.process`, immediately after `resolveClientId`. The raw id stays in a local
variable that is not put into `report`, logs, errors or services. `report.clientId` and
`CommandMeasurement.clientId` become the pseudonym (FR-5). `CommandWindow` loses its own
HMAC/key (`digest` option removed) and stores the pseudonym as is. If `pseudonymize` throws, the
exception goes through the existing `handle()` catch -> `error`, `clientId` stays `null`
(NFR-5, AC-15). No missing-id request is hashed (FR-8).

### D-5: Cleanup by a `StateStore` decorator

`createScopedStateStore(env)` returns the file store wrapped in `ClientScopedStateStore`. It applies the
pure function `purgeForeignClients(state, validKeyId)` to
- the `next` state of every `transact` (so records of other/expired keys and legacy raw ids are
  never re-saved, whichever writer runs: limits, `addResult`, `addTokens`, sweep),
- the result of `read()` (in memory only), so the metrics `inProgress` never counts stale marks.

`validKeyId` comes from `keyring.validKeyId()`, which never creates a key: no key (idle, restart)
means every client record is dropped. A request that straddles the rotation hashes with the old
key; its last writes are purged immediately and the client simply starts fresh (FR-6). This
covers FR-7 and AC-11/AC-12 without any change to `rules.ts`. The file-store factory is split out
(`createFileStateStore`) so that `privacy/` does not import `createScopedStateStore` (import cycle).

### D-6: Cleanup without traffic – lazy variant is NOT enough

The lazy check (clock compared on every use) is authoritative but cannot act on an idle server:
- **Key in memory after midnight:** a key exists only after a request created it, so arming a
  timer *at creation* covers it. The timer fires at expiry, discards the key (sync) and then runs
  the state sweep.
- **Hashes or legacy raw IPs on disk after a restart:** no key exists, no request has loaded any
  route module, so only server start can clean it. Next's `instrumentation.ts` `register()` runs
  once per server instance and completes before requests are served (checked in the Next 16
  docs); it must be guarded with `NEXT_RUNTIME === "nodejs"` and import the module dynamically.
  It runs the same sweep once (drops all client records, prunes expired data, never creates a key).

So: lazy check = correctness, creation-time timer = guarantee for the key, boot sweep = guarantee
for the disk. No periodic polling timer is needed (after a sweep neither a key nor hashes exist
until a request creates them, and creating a key arms the timer).

`KeyExpirySweeper` (`globalThis` singleton, two timer slots: key expiry and sweep retry; each
holds at most one timer, a new one replaces the old, so at most two timers are ever pending):
- `arm(expiresAt)`: replaces only the pending expiry timer and leaves a pending retry alone (the
  retry still has to remove data left by a failed sweep); `setTimeout` is `unref()`'d so it never
  keeps the process alive; delay <= 24 h (below the 2^31 ms timer limit).
- On fire: `keyring.discardIfExpired()`; if the key is still valid (timer fired early), re-arm for
  its expiry; otherwise run the sweep job. A failed sweep (unreadable state, lock timeout) logs the
  error name only and retries on the separate retry timer after a fixed delay (`SWEEP_RETRY_MS`)
  until it succeeds. Every sweep that actually starts (expiry, retry, `sweepNow`) cancels a pending
  retry, as it does the same job; after a success nothing is scheduled.
- `sweepNow()`: the boot variant, same job and retry.
- Clarification (code review): a single shared slot let a retry cancel the expiry timer of a key
  created meanwhile; the two slots prevent that. Public interface is unchanged.
- The sweep job: `discardIfExpired()`, then one `transact` on the decorated store with
  `pruneState(state, now)` (existing function). It uses `getEnv()` at call time; at boot an invalid
  env is caught and logged by name so `register()` never prevents the server from starting.

### D-7: Metrics window keeps old pseudonyms up to one hour

Window records (memory only) are not rewritten at rotation; their key is destroyed, they are
unlinkable and vanish within an hour. Rewriting them would lower "active clients" (FR-9 accepts the
double count instead).

## Dependencies

| Package | Version | Purpose | Install / bundle size |
|---|---|---|---|
| none | - | `node:crypto` (`createHmac`, `randomBytes`), `setTimeout` | 0 |

## Components

| Component | Responsibility | Folder |
|---|---|---|
| `ClientKeyring`, pseudonym format, `purgeForeignClients` | key lifetime, hashing, record test | `src/server/privacy/` |
| `ClientScopedStateStore` | decorator that purges on write/read | `src/server/privacy/` |
| `KeyExpirySweeper`, sweep job, shared instances | timer, boot and expiry cleanup | `src/server/privacy/` |
| `createScopedStateStore` / `createFileStateStore` | wiring of the decorator | `src/server/state/` |
| Handler pseudonymization, route wiring | hash after resolving the id | `src/server/command/`, `src/app/api/command/` |
| `CommandWindow` | digest and own key removed | `src/server/metrics/app/` |
| `instrumentation.ts` | calls the boot sweep (Node runtime only) | `src/` |

## Data flow

1. Request -> guard -> `resolveClientId` (raw id) -> `deps.pseudonymize(raw)`.
2. Keyring: no key or expired -> discard, draw key + keyId, `onKeyCreated(expiresAt)` arms the
   sweeper; HMAC -> pseudonym. Throw -> `error` response, nothing stored.
3. Limits `transact`: rule runs on the pseudonym; decorator purges `next` (other keys, legacy ids)
   before the atomic write. `report.clientId` -> measurement -> window stores the same pseudonym.
4. Idle at midnight: timer fires -> key discarded -> sweep `transact` removes all client records.
5. Server start: `register()` -> `sweepNow()` -> legacy/old records removed before the first request.

## Interfaces

```ts
// src/server/privacy/
export type Pseudonymizer = (clientId: string) => string; // throws on failure; message never
                                                          // contains the input
export interface ClientKeyringOptions {
  clock: Clock;                                    // from state/types
  randomBytes(length: number): Uint8Array;         // default: node:crypto randomBytes
  onKeyCreated?(expiresAt: number): void;          // must not throw into the caller
}
export interface ClientKeyring {
  pseudonymize: Pseudonymizer;
  /** keyId of the live key; null when none or expired (expired key is discarded). Never creates. */
  validKeyId(): string | null;
  discardIfExpired(): void;
}
export function purgeForeignClients(state: StateData, validKeyId: string | null): StateData;

export interface KeyExpirySweeperOptions {
  clock: Clock;
  keyring: Pick<ClientKeyring, "discardIfExpired" | "validKeyId">;
  sweep(): Promise<void>;                          // the sweep job (D-6)
  log(code: string): void;                         // error name only
  timers?: { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void };
}
export interface KeyExpirySweeper { arm(expiresAt: number): void; sweepNow(): Promise<void> }

// globalThis singletons (declare global): geogrindClientKeyring, geogrindKeyExpirySweeper
export function sharedClientKeyring(): ClientKeyring;
export function sharedKeyExpirySweeper(): KeyExpirySweeper;

// src/server/command/commandHandler.ts - CommandHandlerDeps gains:
//   pseudonymize: Pseudonymizer;
// src/server/metrics/app/commandMeasurement.ts - CommandMeasurement.clientId is now the
//   pseudonym (comment updated); CommandWindowOptions loses `digest`.
// src/instrumentation.ts
export function register(): Promise<void>;        // Node runtime only; swallows and logs errors
```

No change to `StateData`, `StateStore`, `MetricsResponse`, `.env.example` or any API shape.

## External services

None added or changed. No new env variable (NFR-1, AC-17).

## Error handling

- Hashing or key generation fails (also a key shorter than 32 bytes) -> exception -> existing
  `error` response; no raw id stored, logged or put into a message (FR-1, NFR-5, AC-15).
- `onKeyCreated`/`arm` fails -> logged by name, request unaffected; the lazy check still rotates.
- Sweep fails (state unreadable, lock timeout) -> error name logged, separate retry timer; the key is
  already destroyed, so remaining hashes are unlinkable (FR-7).
- Boot sweep with invalid env or unreadable file -> logged, server starts, retry as above.
- State file with raw ids -> purged on the next write (boot sweep or first request), never matched
  (AC-12). Unreadable file keeps today's behavior (`StateUnavailableError` -> `error`).
- System clock jumps backwards -> a key may outlive 24 h by the size of the jump (risk below).

## Requirement traceability

| Requirement | Covered by |
|---|---|
| FR-1, AC-1, AC-2 | D-4, T-2 (pseudonymize in handler), T-3 (purge) |
| FR-2, AC-3, AC-4 | D-1, T-1 |
| FR-3, AC-5, AC-6 | D-3, T-1 (no disk write; new key per process), T-4 (boot sweep) |
| FR-4, AC-7, AC-8 | D-2, D-3, T-1 |
| FR-5, AC-9 | D-4, T-2 |
| FR-6, AC-10 | D-5 (documented, no rule change) |
| FR-7, AC-11, AC-12 | D-5, D-6, T-3, T-4 |
| FR-8, AC-13 | D-4, T-2 |
| FR-9, AC-14 | D-7, T-2 |
| NFR-1, AC-17 | no dependency, no env |
| NFR-2 | no user-visible text |
| NFR-3, NFR-4 | D-1, D-3, T-1 |
| NFR-5, AC-15 | D-4, Error handling |
| NFR-6, AC-16 | `clock`, `randomBytes`, `timers` options |
| NFR-7 | documented in Risks |
| NFR-9 | pseudonym is available to a later log via the handler |
| New requirement: cleanup on an idle server | D-6, T-4 |

## Implementation plan

1. **T-1: Keyring** – `ClientKeyring`, pseudonym format and parser, `purgeForeignClients`. Done
   when: fake clock and `randomBytes` tests cover same id/same hash, different ids, midnight
   boundary, restart, two keys differ, hash differs from plain SHA-256, short key rejected.
   Covers: FR-2..4, AC-3, 4, 6, 7, 8, 16.
2. **T-2: Hash in the handler** – `deps.pseudonymize`, route wiring with `sharedClientKeyring()`,
   remove the digest from `CommandWindow`, update comments and tests. Done when: the state and the
   window get the same pseudonym, a throwing `pseudonymize` gives `error` with `clientId` null,
   missing id behaves as before. Covers: FR-1, 5, 8, 9, AC-1, 2, 9, 13, 14, 15.
3. **T-3: Scoped store** – `ClientScopedStateStore`, split `createFileStateStore`, wire in
   `createScopedStateStore` (also used by `createMetricsServices`). Done when: tests on a temp-dir
   `FileStateStore` show a legacy file with raw ids cleaned on the first write, old-key records
   dropped after rotation and restart, `read()` filtered, daily cap and tokens untouched.
   Covers: FR-6, 7, AC-10, 11, 12.
4. **T-4: Sweeper and boot** – `KeyExpirySweeper`, sweep job, shared instances, `onKeyCreated`
   wiring, `src/instrumentation.ts`. Done when: tests with fake timers show: the timer arms on key
   creation and destroys the key plus cleans the state at midnight with no request; early fire
   re-arms; failed sweep retries; one expiry timer after duplicate `arm`; a retry and the expiry
   of a newly armed key do not cancel each other; `arm` keeps a pending retry; a sweep that starts
   cancels a pending retry; timers are unref'd; boot sweep
   cleans a legacy file without a request. Covers: FR-3, 4, 7, AC-5, 11.
5. **T-5: Docs and checks** – README (what is stored and for how long), `docs/architecture.md`
   already updated by this design. Done when: lint, typecheck, test, build green; manual: with
   `next start`, state file contains only `~` pseudonyms, and after midnight (system clock moved)
   on an idle server the file has no client records.

## Testing

Vitest, no network. Keyring and sweeper with fake clock, deterministic `randomBytes` and fake
timers; decorator and legacy migration on a temp dir with `FileStateStore`; handler with stub
`pseudonymize`. A test greps the state file and the window summary for the test IPs (AC-1, 2).
Manual: the `register()` hook under `next start` (not under unit tests).

## Risks / open questions

- While the key lives, the hash is pseudonymised personal data; terms (step 2) must say so.
- `instrumentation.ts` runs in `next start` and `next dev`; if the host runs several instances
  (not supported, NFR-7) each has its own key and sweep.
- Zero-filling and unref cannot guarantee that copies made by Node/V8 are gone; the key is also
  lost with the process.
- A backwards clock jump can extend a key beyond 24 h; accepted for a single-host demo.
- Window pseudonyms of the old key remain in memory up to an hour (D-7).
