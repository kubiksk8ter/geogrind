import { describe, expect, it, vi } from "vitest";
import { FakeClock } from "@/test/fakeClock";
import { FakeTimers } from "@/test/fakeTimers";
import {
  createKeyExpirySweeper,
  SWEEP_RETRY_MS,
  unrefTimers,
} from "./keyExpirySweeper";

const MIDNIGHT = Date.UTC(2026, 10, 10);

class SweepFailedError extends Error {
  name = "SweepFailedError";
}

function setup() {
  const clock = new FakeClock();
  const timers = new FakeTimers();
  let keyId: string | null = "liveKey0";
  const keyring = {
    discardIfExpired: vi.fn(() => {
      if (clock.now() >= MIDNIGHT) keyId = null;
    }),
    validKeyId: () => keyId,
  };
  const sweep = vi.fn(async () => {});
  const log = vi.fn<(code: string) => void>();
  const sweeper = createKeyExpirySweeper({
    clock,
    keyring,
    sweep,
    log,
    timers,
  });
  return { clock, timers, keyring, sweep, log, sweeper };
}

describe("KeyExpirySweeper timer", () => {
  it("arms one timer for the expiry of the key", () => {
    const { sweeper, timers, clock } = setup();

    sweeper.arm(MIDNIGHT);

    expect(timers.delays()).toEqual([MIDNIGHT - clock.now()]);
  });

  it("AC-11: at expiry it destroys the key and sweeps the state without any request", async () => {
    const { sweeper, timers, clock, keyring, sweep } = setup();
    sweeper.arm(MIDNIGHT);

    clock.set(MIDNIGHT);
    timers.fireAll();

    expect(keyring.discardIfExpired).toHaveBeenCalled();
    expect(keyring.validKeyId()).toBeNull();
    await vi.waitFor(() => expect(sweep).toHaveBeenCalledOnce());
    expect(timers.delays()).toEqual([]);
  });

  it("a timer that fires early re-arms for the rest and does not sweep", () => {
    const { sweeper, timers, clock, sweep } = setup();
    sweeper.arm(MIDNIGHT);

    clock.set(MIDNIGHT - 1_000);
    timers.fireAll();

    expect(sweep).not.toHaveBeenCalled();
    expect(timers.delays()).toEqual([1_000]);
  });

  it("a second arm replaces the pending timer, so there is only one", () => {
    const { sweeper, timers, clock } = setup();

    sweeper.arm(MIDNIGHT);
    sweeper.arm(MIDNIGHT + 1_000);

    expect(timers.delays()).toEqual([MIDNIGHT + 1_000 - clock.now()]);
  });

  it("an expiry in the past fires at once", () => {
    const { sweeper, timers } = setup();

    sweeper.arm(0);

    expect(timers.delays()).toEqual([0]);
  });
});

describe("KeyExpirySweeper failures", () => {
  it("a failed sweep logs the error name and retries until it succeeds", async () => {
    const { sweeper, timers, clock, sweep, log } = setup();
    sweep.mockRejectedValueOnce(new SweepFailedError("203.0.113.7"));
    sweeper.arm(MIDNIGHT);
    clock.set(MIDNIGHT);

    timers.fireAll();
    await vi.waitFor(() => expect(timers.delays()).toEqual([SWEEP_RETRY_MS]));
    expect(log).toHaveBeenCalledExactlyOnceWith("SweepFailedError");

    timers.fireAll();
    await vi.waitFor(() => expect(sweep).toHaveBeenCalledTimes(2));
    expect(timers.delays()).toEqual([]);
  });

  it("a key armed while the expiry sweep is failing still expires (retry does not cancel it)", async () => {
    const { sweeper, timers, clock, sweep, keyring } = setup();
    let failSweep: (error: Error) => void = () => {};
    sweep.mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          failSweep = reject;
        }),
    );
    sweeper.arm(MIDNIGHT);
    clock.set(MIDNIGHT);
    timers.fireAll();
    await vi.waitFor(() => expect(sweep).toHaveBeenCalledOnce());

    const nextExpiry = MIDNIGHT + 86_400_000;
    sweeper.arm(nextExpiry);
    failSweep(new SweepFailedError());

    await vi.waitFor(() =>
      expect(timers.delays().sort((a, b) => a - b)).toEqual([
        SWEEP_RETRY_MS,
        nextExpiry - MIDNIGHT,
      ]),
    );

    clock.set(nextExpiry);
    keyring.discardIfExpired.mockClear();
    timers.fireAll();
    expect(keyring.discardIfExpired).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(sweep).toHaveBeenCalledTimes(2));
    expect(timers.delays()).toEqual([]);
  });

  it("a key armed after the sweep failed keeps both the retry and its expiry", async () => {
    const { sweeper, timers, clock, sweep, keyring } = setup();
    sweep.mockRejectedValueOnce(new SweepFailedError());
    sweeper.arm(MIDNIGHT);
    clock.set(MIDNIGHT);
    timers.fireAll();
    await vi.waitFor(() => expect(timers.delays()).toEqual([SWEEP_RETRY_MS]));

    const nextExpiry = MIDNIGHT + 86_400_000;
    sweeper.arm(nextExpiry);

    expect(timers.delays().sort((a, b) => a - b)).toEqual([
      SWEEP_RETRY_MS,
      nextExpiry - MIDNIGHT,
    ]);
    clock.set(nextExpiry);
    keyring.discardIfExpired.mockClear();
    timers.fireAll();
    expect(keyring.discardIfExpired).toHaveBeenCalledOnce();
    // The retry and the new key's expiry each run a sweep.
    await vi.waitFor(() => expect(sweep).toHaveBeenCalledTimes(3));
    expect(timers.delays()).toEqual([]);
  });

  it("a sweep that starts replaces a pending retry, so a success leaves no timer", async () => {
    const { sweeper, timers, sweep } = setup();
    sweep.mockRejectedValueOnce(new SweepFailedError());
    await sweeper.sweepNow();
    expect(timers.delays()).toEqual([SWEEP_RETRY_MS]);

    await sweeper.sweepNow();

    expect(sweep).toHaveBeenCalledTimes(2);
    expect(timers.delays()).toEqual([]);
  });

  it("sweepNow (server start) runs the sweep once", async () => {
    const { sweeper, sweep, timers } = setup();

    await sweeper.sweepNow();

    expect(sweep).toHaveBeenCalledOnce();
    expect(timers.delays()).toEqual([]);
  });

  it("sweepNow never rejects; a failure is logged and retried later", async () => {
    const { sweeper, sweep, timers, log } = setup();
    sweep.mockRejectedValueOnce(new SweepFailedError());

    await expect(sweeper.sweepNow()).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith("SweepFailedError");
    expect(timers.delays()).toEqual([SWEEP_RETRY_MS]);
  });
});

describe("unrefTimers", () => {
  const isNodeTimeout = (handle: unknown): handle is NodeJS.Timeout =>
    handle instanceof Object && "hasRef" in handle;

  it("never keep the process alive and can be cleared", () => {
    const fn = vi.fn();
    const handle = unrefTimers.set(fn, 60_000);

    expect(isNodeTimeout(handle)).toBe(true);
    expect(isNodeTimeout(handle) && handle.hasRef()).toBe(false);

    unrefTimers.clear(handle);
    expect(fn).not.toHaveBeenCalled();
  });
});
