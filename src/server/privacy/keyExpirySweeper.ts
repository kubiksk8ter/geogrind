import type { Clock } from "../state/types";
import type { ClientKeyring } from "./clientKeyring";

/** Wait before a failed sweep (unreadable state, lock timeout, broken env) is tried again. */
export const SWEEP_RETRY_MS = 60_000;

export interface SweeperTimers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface KeyExpirySweeperOptions {
  clock: Clock;
  keyring: Pick<ClientKeyring, "discardIfExpired" | "validKeyId">;
  /** Destroys an expired key and removes client data from the state (the sweep job). */
  sweep(): Promise<void>;
  /** Receives the error name only. */
  log(code: string): void;
  timers?: SweeperTimers;
}

export interface KeyExpirySweeper {
  /** Schedules the cleanup for the expiry of the key just created; replaces a pending expiry, keeps a pending retry. */
  arm(expiresAt: number): void;
  /** Runs the cleanup now (server start); never rejects, a failure is retried later. */
  sweepNow(): Promise<void>;
}

const isNodeTimeout = (handle: unknown): handle is NodeJS.Timeout =>
  typeof handle === "object" && handle !== null && "unref" in handle;

/** Node timers that never keep the process alive. */
export const unrefTimers: SweeperTimers = {
  set(fn, ms) {
    return setTimeout(fn, ms).unref();
  },
  clear(handle) {
    if (isNodeTimeout(handle)) clearTimeout(handle);
  },
};

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

/** One timer that is replaced, never stacked, when it is scheduled again. */
function createTimerSlot(timers: SweeperTimers) {
  let handle: unknown = null;

  function cancel(): void {
    if (handle === null) return;
    timers.clear(handle);
    handle = null;
  }

  function schedule(task: () => void, ms: number): void {
    cancel();
    handle = timers.set(() => {
      handle = null;
      task();
    }, ms);
  }

  return { schedule, cancel };
}

/**
 * Cleans up when a key expires even if no request comes: the expiry timer, armed when a key is
 * created, destroys the key at its expiry and sweeps the state. A failed sweep is retried on a
 * separate retry timer, so a retry and the expiry of a key created meanwhile never cancel each
 * other; each slot holds at most one timer, so there are never more than two pending.
 *
 * `arm` leaves a pending retry alone: the new key's sweep runs only at its expiry, while the
 * retry still has to remove the data the failed sweep left behind. Any sweep that starts does
 * replace the pending retry, as it does the same job.
 */
export function createKeyExpirySweeper({
  clock,
  keyring,
  sweep,
  log,
  timers = unrefTimers,
}: KeyExpirySweeperOptions): KeyExpirySweeper {
  const expiryTimer = createTimerSlot(timers);
  const retryTimer = createTimerSlot(timers);

  async function runSweep(): Promise<void> {
    retryTimer.cancel();
    try {
      await sweep();
    } catch (error) {
      log(errorName(error));
      retryTimer.schedule(() => void runSweep(), SWEEP_RETRY_MS);
    }
  }

  function arm(expiresAt: number): void {
    expiryTimer.schedule(
      () => onExpiry(expiresAt),
      Math.max(0, expiresAt - clock.now()),
    );
  }

  function onExpiry(expiresAt: number): void {
    keyring.discardIfExpired();
    const firedEarly = clock.now() < expiresAt;
    if (firedEarly && keyring.validKeyId() !== null) {
      arm(expiresAt);
      return;
    }
    void runSweep();
  }

  return { arm, sweepNow: runSweep };
}
