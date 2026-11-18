import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { metricsResponseSchema, noResults } from "@/shared/metricsContract";
import { FakeClock } from "@/test/fakeClock";
import { MemoryStateStore } from "@/test/memoryStateStore";
import type { AiAnswer } from "../ai/aiAnswer";
import { type AppEnv, ConfigError } from "../config/env";
import { CommandLimits } from "../state/limits";
import { StateUnavailableError } from "../state/types";
import { InMemoryAiFigures } from "./ai/aiFigures";
import { CommandWindow } from "./app/commandWindow";
import { InMemoryServiceStatus } from "./app/serviceStatus";
import { createMetricsHandler } from "./metricsHandler";

const ORIGIN = "https://geogrind.example";
const ENV: AppEnv = {
  groqApiKey: "test-key-not-real",
  groqModel: "test-model",
  geocoderUrl: "https://geocoder.example",
  geocoderContact: undefined,
  clientIpHeader: "x-real-ip",
  appOrigins: [ORIGIN],
  stateDir: ".data",
  dailyCap: 500,
};

const NO_FIGURE = { remaining: null, limit: null, resetsAt: null };

function setup() {
  const clock = new FakeClock(Date.UTC(2026, 10, 13, 12));
  const store = new MemoryStateStore();
  const figures = new InMemoryAiFigures();
  const commandWindow = new CommandWindow({ clock });
  const nominatim = new InMemoryServiceStatus();
  const log = vi.fn();
  const state = { loadEnv: () => ENV };
  const handle = createMetricsHandler({
    loadEnv: () => state.loadEnv(),
    createServices: () => ({
      store,
      figures,
      commandWindow,
      nominatim,
      clock,
    }),
    log,
  });
  const send = (headers: Record<string, string>, method = "GET") =>
    handle(
      new Request("https://geogrind.example/api/metrics", { method, headers }),
    );
  const get = (headers: Record<string, string> = {}, method = "GET") =>
    send({ "sec-fetch-site": "same-origin", ...headers }, method);
  return {
    clock,
    store,
    figures,
    commandWindow,
    nominatim,
    log,
    state,
    get,
    send,
  };
}

const body = async (response: Response) => await response.json();

describe("GET /api/metrics", () => {
  it("AC-10, AC-11: a fresh start has the model and the cap and no other figures", async () => {
    const { get } = setup();

    const response = await get();

    expect(response.status).toBe(200);
    const parsed = v.parse(metricsResponseSchema, await body(response));
    expect(parsed).toMatchObject({
      ok: true,
      metrics: {
        ai: {
          model: "test-model",
          dailyCap: { used: 0, cap: 500, resetsAt: Date.UTC(2026, 10, 14) },
          dailyTokens: 0,
          lastRequest: null,
          limits: null,
        },
      },
    });
  });

  it("AC-9: shows the counter of the day and the cap, also when reached", async () => {
    const { get, store, clock } = setup();
    await store.transact((state) => ({
      next: {
        ...state,
        daily: {
          day: "2026-11-13",
          count: 500,
          tokens: 270,
          results: noResults(),
        },
      },
      result: undefined,
    }));

    const parsed = await body(await get());

    expect(parsed.metrics.ai.dailyCap).toMatchObject({ used: 500, cap: 500 });
    expect(parsed.metrics.ai.dailyTokens).toBe(270);
    expect(parsed.metrics.serverNow).toBe(clock.now());
  });

  it("AC-9, AC-4: after UTC midnight the counters read 0 without a write", async () => {
    const { get, store, clock } = setup();
    await store.transact((state) => ({
      next: {
        ...state,
        daily: {
          day: "2026-11-13",
          count: 37,
          tokens: 270,
          results: { ...noResults(), success: 37 },
        },
      },
      result: undefined,
    }));
    const before = store.snapshot();
    clock.set(Date.UTC(2026, 10, 14, 0, 0, 5));

    const parsed = await body(await get());

    expect(parsed.metrics.ai.dailyCap.used).toBe(0);
    expect(parsed.metrics.ai.dailyTokens).toBe(0);
    expect(parsed.metrics.app.results).toEqual(noResults());
    expect(store.snapshot()).toBe(before);
  });

  it("returns the last request and the limits known in memory", async () => {
    const { get, figures } = setup();
    const answer: AiAnswer = {
      receivedAt: 5000,
      usage: { prompt: 120, completion: 30, total: 150 },
      limits: {
        requests: { remaining: 480, limit: 500, resetsAt: 9000 },
        tokens: NO_FIGURE,
      },
    };
    figures.update(answer);

    const { metrics } = await body(await get());

    expect(metrics.ai.lastRequest).toEqual({
      at: 5000,
      prompt: 120,
      completion: 30,
      total: 150,
    });
    expect(metrics.ai.limits.requests).toEqual(answer.limits.requests);
  });

  it("FR-14, AC-15: the answer holds no secrets, no content and no address", async () => {
    const { get } = setup();

    const text = JSON.stringify(await body(await get()));

    expect(text).not.toContain(ENV.groqApiKey);
    expect(text).not.toContain("203.0.113.7");
    expect(text).not.toContain(ENV.stateDir);
  });

  it("AC-13: reading touches neither the limits nor the state", async () => {
    const { get, store } = setup();
    const transact = vi.spyOn(store, "transact");
    const before = store.snapshot();

    await get();
    await get();

    expect(transact).not.toHaveBeenCalled();
    expect(store.snapshot()).toBe(before);
  });

  it("FR-15: every answer is uncached and has no cross-origin headers", async () => {
    const { get } = setup();

    const headers = (await get()).headers;

    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("access-control-allow-origin")).toBeNull();
  });

  it("AC-16: accepts a same-origin request that carries an allowed Origin", async () => {
    const { get } = setup();

    expect((await get({ origin: ORIGIN })).status).toBe(200);
  });

  it.each([
    ["a foreign fetch site", { "sec-fetch-site": "cross-site" }],
    ["a same-site fetch site", { "sec-fetch-site": "same-site" }],
    ["a missing fetch site (curl)", {}],
    [
      "a foreign Origin",
      { "sec-fetch-site": "same-origin", origin: "https://evil.example" },
    ],
  ])("AC-16: rejects %s without figures", async (_name, headers) => {
    const { send } = setup();

    const response = await send(headers);

    expect(response.status).toBe(403);
    expect(await body(response)).toEqual({
      ok: false,
      error: { code: "invalid_request" },
    });
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "AC-16: %s is rejected with 405 and the same shape",
    async (method) => {
      const { get } = setup();

      const response = await get({}, method);

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET");
      expect(await body(response)).toEqual({
        ok: false,
        error: { code: "invalid_request" },
      });
    },
  );

  it("AC-14: an unreadable state file gives the generic error", async () => {
    const { get, store, log } = setup();
    vi.spyOn(store, "read").mockRejectedValue(
      new StateUnavailableError("corrupt /secret/path"),
    );

    const response = await get();

    expect(response.status).toBe(500);
    expect(await body(response)).toEqual({
      ok: false,
      error: { code: "error" },
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "error",
        cause: "StateUnavailableError",
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("/secret/path");
  });

  it("a broken configuration gives the generic error", async () => {
    const { get, state } = setup();
    state.loadEnv = () => {
      throw new ConfigError("Invalid environment variables: X");
    };

    expect((await get()).status).toBe(500);
  });
});

describe("GET /api/metrics, application group", () => {
  it("AC-12: a fresh start has no results, unknown hour figures, 0 in progress and unknown Nominatim", async () => {
    const { get, clock } = setup();

    const parsed = v.parse(metricsResponseSchema, await body(await get()));

    expect(parsed.ok && parsed.metrics.app).toEqual({
      results: noResults(),
      window: {
        startedAt: clock.now(),
        durationMs: 3_600_000,
        bucketMs: 300_000,
      },
      load: {
        lastMinute: 0,
        lastHour: null,
        activeClients: null,
        inProgress: 0,
      },
      latency: null,
      services: { nominatim: null },
    });
  });

  it("AC-2: shows today's results from the state file", async () => {
    const { get, store } = setup();
    await store.transact((state) => ({
      next: {
        ...state,
        daily: {
          day: "2026-11-13",
          count: 7,
          tokens: 0,
          results: { ...noResults(), success: 6, error: 1 },
        },
      },
      result: undefined,
    }));

    const { metrics } = await body(await get());

    expect(metrics.app.results).toEqual({
      ...noResults(),
      success: 6,
      error: 1,
    });
  });

  it("AC-6: one command in progress shows 1 and returns to 0 when it ends", async () => {
    const { get, store, clock } = setup();
    const limits = new CommandLimits(store, clock, ENV.dailyCap);
    await limits.recordHit("203.0.113.7");
    await limits.admit("203.0.113.7");

    expect((await body(await get())).metrics.app.load.inProgress).toBe(1);

    await limits.complete("203.0.113.7");

    expect((await body(await get())).metrics.app.load.inProgress).toBe(0);
  });

  it("AC-6, AC-10: carries the window figures and the Nominatim state from memory", async () => {
    const { get, commandWindow, nominatim } = setup();
    commandWindow.record({
      result: "success",
      durationMs: 640,
      clientId: "203.0.113.7",
    });
    nominatim.report(false);

    const { metrics } = await body(await get());

    expect(metrics.app.load).toMatchObject({
      lastMinute: 1,
      lastHour: 1,
      activeClients: 1,
    });
    expect(metrics.app.latency).toMatchObject({ count: 1, medianMs: 640 });
    expect(metrics.app.services).toEqual({ nominatim: false });
  });

  it("AC-14: repeated reads change no figure and record nothing", async () => {
    const { get, store, commandWindow, nominatim } = setup();
    const record = vi.spyOn(commandWindow, "record");
    const report = vi.spyOn(nominatim, "report");
    const transact = vi.spyOn(store, "transact");

    const first = await body(await get());
    const second = await body(await get());

    expect(second).toEqual(first);
    expect(first.metrics.app.load).toMatchObject({
      lastHour: null,
      activeClients: null,
      inProgress: 0,
    });
    expect(record).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expect(transact).not.toHaveBeenCalled();
  });

  it("AC-7: no client address appears in the answer", async () => {
    const { get, commandWindow, store, clock } = setup();
    commandWindow.record({
      result: "success",
      durationMs: 1,
      clientId: "203.0.113.7",
    });
    await new CommandLimits(store, clock, ENV.dailyCap).admit("198.51.100.4");

    const text = JSON.stringify(await body(await get()));

    expect(text).not.toContain("203.0.113.7");
    expect(text).not.toContain("198.51.100.4");
  });

  it("AC-15: a foreign origin gets no figures of the group", async () => {
    const { send } = setup();

    const response = await send({ "sec-fetch-site": "cross-site" });

    expect(response.status).toBe(403);
    expect(JSON.stringify(await body(response))).not.toContain("app");
  });
});
