import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSnapshot } from "@/test/metricsSnapshot";
import type { LoadMetrics } from "./metricsClient";
import { type MetricsPollState, startMetricsPoller } from "./metricsPoller";

class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(load: LoadMetrics = vi.fn(async () => makeSnapshot())) {
  const page = new FakePage();
  const states: MetricsPollState[] = [];
  const stop = startMetricsPoller({
    load,
    onState: (state) => states.push(state),
    intervalMs: 10_000,
    now: Date.now,
    page,
  });
  return { page, states, load, stop };
}

describe("metrics poller", () => {
  it("AC-13: loads at once and then at the interval", async () => {
    const { load, states, stop } = setup();

    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.snapshot).not.toBeNull();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(load).toHaveBeenCalledTimes(3);
    stop();
  });

  it("computes the clock offset from the server time of the answer", async () => {
    vi.setSystemTime(1_000_000);
    const { states, stop } = setup(
      vi.fn(async () => makeSnapshot({}, 1_005_000)),
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(states.at(-1)?.clockOffsetMs).toBe(5_000);
    stop();
  });

  it("AC-13: a hidden page pauses polling and becoming visible loads at once", async () => {
    const { page, load, stop } = setup();
    await vi.advanceTimersByTimeAsync(0);

    page.setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).toHaveBeenCalledTimes(1);

    page.setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(load).toHaveBeenCalledTimes(3);
    stop();
  });

  it("AC-14: a failure keeps the last snapshot, marks it and the next tick recovers", async () => {
    const results = [makeSnapshot(), null, makeSnapshot({ dailyTokens: 999 })];
    const load = vi.fn(async () => results.shift() ?? null);
    const { states, stop } = setup(load);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);
    const failed = states.at(-1);
    expect(failed?.failed).toBe(true);
    expect(failed?.snapshot?.ai.dailyTokens).toBe(270);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(states.at(-1)?.failed).toBe(false);
    expect(states.at(-1)?.snapshot?.ai.dailyTokens).toBe(999);
    stop();
  });

  it("stops loading and publishing after stop", async () => {
    const { load, states, stop } = setup();
    await vi.advanceTimersByTimeAsync(0);
    const published = states.length;

    stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(load).toHaveBeenCalledTimes(1);
    expect(states).toHaveLength(published);
  });
});
