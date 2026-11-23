import { beforeEach, describe, expect, it } from "vitest";
import { FakeClock } from "@/test/fakeClock";
import { MemoryStateStore } from "@/test/memoryStateStore";
import { CommandLimits } from "./limits";
import {
  COOLDOWN_MS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  REQUEST_BUDGET_MS,
} from "./rules";

const DAILY_CAP = 3;
const CLIENT = "203.0.113.7";
const OTHER_CLIENT = "203.0.113.8";

let clock: FakeClock;
let store: MemoryStateStore;
let limits: CommandLimits;

beforeEach(() => {
  clock = new FakeClock(Date.UTC(2026, 10, 9, 12, 0, 0));
  store = new MemoryStateStore();
  limits = new CommandLimits(store, clock, DAILY_CAP);
});

describe("cooldown", () => {
  it("AC-12: a request 9 s after a success must wait for the remaining second", async () => {
    await limits.admit(CLIENT);
    await limits.complete(CLIENT);
    clock.advance(9_000);

    expect(await limits.admit(CLIENT)).toEqual({
      kind: "wait",
      retryAfterSeconds: 1,
    });
  });

  it("AC-12: a request 10 s after a success is admitted", async () => {
    await limits.admit(CLIENT);
    await limits.complete(CLIENT);
    clock.advance(COOLDOWN_MS);

    expect(await limits.admit(CLIENT)).toEqual({ kind: "admitted" });
  });

  it("complete reports the cooldown for the browser", async () => {
    await limits.admit(CLIENT);

    expect(await limits.complete(CLIENT)).toEqual({ cooldownSeconds: 10 });
  });

  it("only the client that succeeded has to wait", async () => {
    await limits.admit(CLIENT);
    await limits.complete(CLIENT);

    expect(await limits.admit(OTHER_CLIENT)).toEqual({ kind: "admitted" });
  });

  it("FR-11: a released failure starts no cooldown", async () => {
    await limits.admit(CLIENT);
    await limits.release(CLIENT);

    expect(await limits.admit(CLIENT)).toEqual({ kind: "admitted" });
  });
});

describe("in-flight request", () => {
  it("AC-29: a concurrent request of the same client is refused as busy", async () => {
    const results = await Promise.all([
      limits.admit(CLIENT),
      limits.admit(CLIENT),
    ]);

    expect(results.map((result) => result.kind).sort()).toEqual([
      "admitted",
      "busy",
    ]);
  });

  it("expires with the request budget even when never released", async () => {
    await limits.admit(CLIENT);
    clock.advance(REQUEST_BUDGET_MS);

    expect(await limits.admit(CLIENT)).toEqual({ kind: "admitted" });
  });
});

describe("rate limit", () => {
  async function hit(times: number) {
    for (let i = 0; i < times; i++) await limits.recordHit(CLIENT);
  }

  it("AC-13: the 11th request within a minute is limited with a wait time", async () => {
    await hit(RATE_LIMIT_MAX);

    expect(await limits.recordHit(CLIENT)).toEqual({
      kind: "limited",
      retryAfterSeconds: 60,
    });
  });

  it("AC-13: works again after the wait", async () => {
    await hit(RATE_LIMIT_MAX);
    clock.advance(RATE_LIMIT_WINDOW_MS);

    expect(await limits.recordHit(CLIENT)).toEqual({ kind: "allowed" });
  });
});

describe("daily cap", () => {
  async function exhaustCap() {
    for (let i = 0; i < DAILY_CAP; i++) {
      await limits.admit(CLIENT);
      await limits.release(CLIENT);
    }
  }

  it("AC-18: refuses the AI when the cap is reached and reports the next UTC midnight", async () => {
    await exhaustCap();

    expect(await limits.admit(OTHER_CLIENT)).toEqual({
      kind: "ai_resting",
      resetAt: Date.UTC(2026, 10, 10),
    });
  });

  it("AC-18: works again the next UTC day", async () => {
    await exhaustCap();
    clock.set(Date.UTC(2026, 10, 10, 0, 0, 0));

    expect(await limits.admit(CLIENT)).toEqual({ kind: "admitted" });
  });
});

describe("exhausted AI quota", () => {
  it("AC-18: blocks the AI for everyone until the retry time and starts no cooldown", async () => {
    await limits.admit(CLIENT);
    await limits.release(CLIENT, { retryAfterSeconds: 120 });

    expect(await limits.admit(CLIENT)).toEqual({
      kind: "ai_resting",
      resetAt: clock.now() + 120_000,
    });
    expect((await limits.admit(OTHER_CLIENT)).kind).toBe("ai_resting");
  });

  it("lasts until the next UTC midnight without a retry time", async () => {
    await limits.admit(CLIENT);
    await limits.release(CLIENT, {});

    expect(await limits.admit(CLIENT)).toEqual({
      kind: "ai_resting",
      resetAt: Date.UTC(2026, 10, 10),
    });
  });
});

describe("clean-up", () => {
  it("drops expired clients and hits so IPs are not kept longer than needed", async () => {
    await limits.recordHit(CLIENT);
    await limits.admit(CLIENT);
    await limits.complete(CLIENT);
    clock.advance(RATE_LIMIT_WINDOW_MS);

    await limits.recordHit(OTHER_CLIENT);

    expect(Object.keys(store.snapshot().clients)).toEqual([OTHER_CLIENT]);
  });
});
