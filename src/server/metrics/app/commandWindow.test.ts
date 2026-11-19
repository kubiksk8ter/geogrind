import { describe, expect, it } from "vitest";
import type { ResultKey } from "@/shared/metricsContract";
import { FakeClock } from "@/test/fakeClock";
import {
  CommandWindow,
  WINDOW_BUCKET_MS,
  WINDOW_DURATION_MS,
} from "./commandWindow";

const MINUTE = 60_000;
// Client ids reach the window already pseudonymised by the command handler (spec 011).
const CLIENT_A = "keyId000~aaaaaaaaaaaaaaaa";
const CLIENT_B = "keyId000~bbbbbbbbbbbbbbbb";
const CLIENT_C = "keyId000~cccccccccccccccc";

function setup(capacity?: number) {
  const clock = new FakeClock();
  const window = new CommandWindow({ clock, capacity });
  /** Records a command that ended `agoMs` before the clock's current time. */
  const recordAgo = (
    agoMs: number,
    durationMs = 500,
    result: ResultKey = "success",
    clientId: string | null = CLIENT_A,
  ) => {
    const now = clock.now();
    clock.set(now - agoMs);
    window.record({ result, durationMs, clientId });
    clock.set(now);
  };
  return { clock, window, recordAgo };
}

describe("CommandWindow after a start", () => {
  it("AC-12, AC-19: nothing recorded: the hour figures are unknown, the last minute is 0, no latency", () => {
    const { window, clock } = setup();

    expect(window.summary()).toEqual({
      window: {
        startedAt: clock.now(),
        durationMs: WINDOW_DURATION_MS,
        bucketMs: WINDOW_BUCKET_MS,
      },
      load: { lastMinute: 0, lastHour: null, activeClients: null },
      latency: null,
    });
  });

  it("FR-11: once a command was recorded the hour figures are known, also when it has expired", () => {
    const { window, recordAgo, clock } = setup();
    recordAgo(0);
    clock.advance(WINDOW_DURATION_MS);

    expect(window.summary().load).toEqual({
      lastMinute: 0,
      lastHour: 0,
      activeClients: 0,
    });
    expect(window.summary().latency).toBeNull();
  });

  it("AC-19: a new window (restart) is empty again", () => {
    const { window, recordAgo, clock } = setup();
    recordAgo(0);

    const afterRestart = new CommandWindow({ clock });

    expect(window.summary().load.lastHour).toBe(1);
    expect(afterRestart.summary().load.lastHour).toBeNull();
  });
});

describe("CommandWindow load", () => {
  it("AC-6: commands 30 s, 5 min and 50 min ago: 1 in the last minute, 3 in the last hour", () => {
    const { window, recordAgo } = setup();
    recordAgo(50 * MINUTE);
    recordAgo(5 * MINUTE);
    recordAgo(30_000);

    expect(window.summary().load).toMatchObject({
      lastMinute: 1,
      lastHour: 3,
    });
  });

  it("AC-5: commands older than 60 min are not included", () => {
    const { window, recordAgo } = setup();
    recordAgo(WINDOW_DURATION_MS, 9_000);
    recordAgo(61 * MINUTE, 9_000);
    recordAgo(10 * MINUTE, 400);

    const { load, latency } = window.summary();

    expect(load.lastHour).toBe(1);
    expect(latency).toMatchObject({ count: 1, medianMs: 400, p95Ms: 400 });
  });

  it("AC-6: three distinct clients in the last hour are 3 active clients", () => {
    const { window, recordAgo } = setup();
    recordAgo(40 * MINUTE, 500, "success", CLIENT_A);
    recordAgo(20 * MINUTE, 500, "not_found", CLIENT_B);
    recordAgo(10 * MINUTE, 500, "wait", CLIENT_C);
    recordAgo(MINUTE, 500, "success", CLIENT_A);

    expect(window.summary().load.activeClients).toBe(3);
  });

  it("a client seen only before the hour is not active", () => {
    const { window, recordAgo } = setup();
    recordAgo(70 * MINUTE, 500, "success", CLIENT_A);
    recordAgo(MINUTE, 500, "success", CLIENT_B);

    expect(window.summary().load.activeClients).toBe(1);
  });

  it("a command without a client address counts as a command, not as a client", () => {
    const { window, recordAgo } = setup();
    recordAgo(0, 5, "error", null);

    expect(window.summary().load).toMatchObject({
      lastHour: 1,
      activeClients: 0,
    });
  });
});

describe("CommandWindow latency", () => {
  it("AC-5: 20 commands with known durations give the nearest-rank median and p95", () => {
    const { window, recordAgo } = setup();
    // 100, 200, ..., 2000 ms, recorded in reverse order.
    const durations = Array.from(
      { length: 20 },
      (_, index) => (index + 1) * 100,
    );
    for (const [index, duration] of [...durations].reverse().entries()) {
      recordAgo((index + 1) * MINUTE, duration);
    }

    expect(window.summary().latency).toMatchObject({
      count: 20,
      medianMs: 1000,
      p95Ms: 1900,
    });
  });

  it("AC-5: a single command gives median and p95 equal to its duration", () => {
    const { window, recordAgo } = setup();
    recordAgo(MINUTE, 1234);

    expect(window.summary().latency).toMatchObject({
      count: 1,
      medianMs: 1234,
      p95Ms: 1234,
    });
  });

  it("wait and too_many_requests count in the load but not in the latency", () => {
    const { window, recordAgo } = setup();
    recordAgo(MINUTE, 2, "wait");
    recordAgo(MINUTE, 3, "too_many_requests");
    recordAgo(MINUTE, 800, "unsupported");

    const { load, latency } = window.summary();

    expect(load.lastHour).toBe(3);
    expect(latency).toMatchObject({ count: 1, medianMs: 800 });
  });

  it("no latency when the hour holds only instant rejections", () => {
    const { window, recordAgo } = setup();
    recordAgo(MINUTE, 2, "wait");

    expect(window.summary().latency).toBeNull();
  });

  it("the sparkline has 12 five-minute buckets, oldest first, with gaps as null", () => {
    const { window, recordAgo } = setup();
    recordAgo(57 * MINUTE, 300);
    recordAgo(2 * MINUTE, 100);
    recordAgo(MINUTE, 900);
    recordAgo(0, 500);

    const series = window.summary().latency?.series;

    expect(series).toHaveLength(WINDOW_DURATION_MS / WINDOW_BUCKET_MS);
    expect(series?.[0]).toBe(300);
    expect(series?.slice(1, 11)).toEqual(Array(10).fill(null));
    expect(series?.[11]).toBe(500);
  });
});

describe("CommandWindow memory and privacy", () => {
  it("AC-20: a very long run of commands keeps at most the capacity", () => {
    const { window, clock } = setup(100);
    for (let index = 0; index < 5_000; index++) {
      window.record({ result: "success", durationMs: 10, clientId: "x" });
      clock.advance(100);
    }

    const { load } = window.summary();

    expect(load.lastHour).toBe(100);
  });

  it("AC-20: when full, the oldest records are replaced by the newest", () => {
    const { window, clock } = setup(3);
    for (const durationMs of [1, 2, 3, 4, 5]) {
      window.record({ result: "success", durationMs, clientId: "x" });
      clock.advance(1);
    }

    expect(window.summary().latency).toMatchObject({ count: 3, medianMs: 4 });
  });

  it("AC-7: no client identifier or address appears in the summary", () => {
    const { window, recordAgo } = setup();
    recordAgo(MINUTE, 500, "success", "203.0.113.7");
    recordAgo(MINUTE, 500, "success", "2001:db8::1");

    const text = JSON.stringify(window.summary());

    expect(text).not.toContain("203.0.113.7");
    expect(text).not.toContain("2001:db8::1");
  });

  it("spec 011 AC-9: the window counts the pseudonym it is given without hashing again", () => {
    const { window, recordAgo } = setup();
    recordAgo(MINUTE, 500, "success", CLIENT_A);
    recordAgo(0, 500, "success", CLIENT_A);

    expect(JSON.stringify(window)).toContain(CLIENT_A);
    expect(window.summary().load.activeClients).toBe(1);
  });
});
