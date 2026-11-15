import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { makeSnapshot } from "@/test/metricsSnapshot";
import {
  metricsResponseSchema,
  metricsSnapshotSchema,
} from "./metricsContract";

const valid = makeSnapshot();

const accepts = (value: unknown) =>
  v.safeParse(metricsResponseSchema, value).success;

describe("metrics contract", () => {
  it("NFR-8: accepts a valid snapshot grouped under `ai`", () => {
    expect(accepts({ ok: true, metrics: valid })).toBe(true);
  });

  it("accepts a fresh start with nothing known", () => {
    const fresh = makeSnapshot({ lastRequest: null, limits: null });

    expect(v.safeParse(metricsSnapshotSchema, fresh).success).toBe(true);
  });

  it("accepts unknown parts of a limit as null", () => {
    const partly = makeSnapshot({
      limits: {
        receivedAt: 1,
        requests: { remaining: null, limit: null, resetsAt: null },
        tokens: { remaining: 5, limit: null, resetsAt: 9 },
      },
    });

    expect(accepts({ ok: true, metrics: partly })).toBe(true);
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
