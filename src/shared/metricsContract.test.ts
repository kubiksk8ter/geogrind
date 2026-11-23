import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { makeSnapshot } from "@/test/metricsSnapshot";
import { metricsResponseSchema, RESULT_KEYS } from "./metricsContract";

const valid = makeSnapshot();

const accepts = (value: unknown) =>
  v.safeParse(metricsResponseSchema, value).success;

describe("metrics contract", () => {
  it("NFR-8: accepts a valid snapshot grouped under `ai`", () => {
    expect(accepts({ ok: true, metrics: valid })).toBe(true);
  });

  it("accepts the error shape and nothing else", () => {
    expect(accepts({ ok: false, error: { code: "invalid_request" } })).toBe(
      true,
    );
    expect(accepts({ ok: false, error: { code: "boom" } })).toBe(false);
    expect(accepts({ ok: false, error: { code: "error", detail: "x" } })).toBe(
      false,
    );
  });

  it.each([
    ["an extra field", { ...valid, extra: 1 }],
    ["an extra field in a group", { ...valid, ai: { ...valid.ai, key: "x" } }],
    ["a missing group", { serverNow: 1 }],
    ["a negative count", { ...valid, ai: { ...valid.ai, dailyTokens: -1 } }],
    ["a fractional count", { ...valid, ai: { ...valid.ai, dailyTokens: 1.5 } }],
    [
      "a zero cap",
      {
        ...valid,
        ai: { ...valid.ai, dailyCap: { used: 0, cap: 0, resetsAt: 1 } },
      },
    ],
  ])("rejects %s", (_name, snapshot) => {
    expect(accepts({ ok: true, metrics: snapshot })).toBe(false);
  });
});

describe("metrics contract, application group", () => {
  const withApp = (app: Record<string, unknown>) => ({
    ...valid,
    app: { ...valid.app, ...app },
  });

  it("NFR-9: `app` is a sibling of `ai`", () => {
    expect(Object.keys(valid)).toEqual(["serverNow", "ai", "app"]);
    expect(accepts({ ok: true, metrics: valid })).toBe(true);
  });

  it("FR-2: lists every processed result and not invalid_request", () => {
    expect(RESULT_KEYS).toEqual([
      "success",
      "unsupported",
      "not_found",
      "wait",
      "too_many_requests",
      "ai_resting",
      "error",
    ]);
  });

  it("FR-11: accepts a fresh start with the unknown figures as null", () => {
    const fresh = withApp({
      load: {
        lastMinute: 0,
        lastHour: null,
        activeClients: null,
        inProgress: 0,
      },
      latency: null,
      services: { nominatim: null },
    });

    expect(accepts({ ok: true, metrics: fresh })).toBe(true);
  });

  it.each([
    ["a missing group", { serverNow: 1, ai: valid.ai }],
    ["an extra field in the group", withApp({ clients: ["203.0.113.7"] })],
    [
      "an extra result",
      withApp({ results: { ...valid.app.results, invalid_request: 1 } }),
    ],
    [
      "a missing result",
      withApp({
        results: { ...valid.app.results, error: undefined },
      }),
    ],
    [
      "a negative count",
      withApp({ results: { ...valid.app.results, success: -1 } }),
    ],
    [
      "an unknown last minute",
      withApp({ load: { ...valid.app.load, lastMinute: null } }),
    ],
    [
      "a client identifier in the load",
      withApp({ load: { ...valid.app.load, clients: ["abc"] } }),
    ],
    [
      "an empty latency (count 0)",
      withApp({
        latency: { count: 0, medianMs: 0, p95Ms: 0, series: [] },
      }),
    ],
    [
      "a fractional latency",
      withApp({
        latency: { count: 1, medianMs: 1.5, p95Ms: 2, series: [] },
      }),
    ],
    [
      "a service state that is not a boolean",
      withApp({ services: { nominatim: "up" } }),
    ],
    [
      "a zero bucket width",
      withApp({ window: { ...valid.app.window, bucketMs: 0 } }),
    ],
  ])("rejects %s", (_name, snapshot) => {
    expect(accepts({ ok: true, metrics: snapshot })).toBe(false);
  });
});
