import { describe, expect, it } from "vitest";
import {
  hasLimitFigure,
  parseGroqDuration,
  parseLimits,
  parseUsage,
} from "./aiAnswer";

describe("parseGroqDuration", () => {
  it.each([
    ["2m59.56s", 179.56],
    ["7.66s", 7.66],
    ["1h2m3s", 3723],
    ["250ms", 0.25],
    ["1d2h", 93_600],
    ["0s", 0],
    ["1m0.5s", 60.5],
    ["1m250ms", 60.25],
  ])("AC-7: parses %s to %f seconds", (value, seconds) => {
    expect(parseGroqDuration(value)).toBe(seconds);
  });

  it.each([
    ["abc"],
    [""],
    ["-5s"],
    ["5"],
    ["5x"],
    ["5 s"],
    ["s"],
    ["1.s"],
    ["NaN"],
    ["Infinitys"],
    ["1e3s"],
    ["999999999d"],
    ["1s2"],
  ])("AC-7, AC-20: %j is unknown", (value) => {
    expect(parseGroqDuration(value)).toBeNull();
  });

  it("AC-7: a missing header is unknown", () => {
    expect(parseGroqDuration(null)).toBeNull();
  });
});

describe("parseUsage", () => {
  it("AC-2: reads the three counts", () => {
    expect(
      parseUsage({
        usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
      }),
    ).toEqual({ prompt: 120, completion: 30, total: 150 });
  });

  it("AC-12: keeps the valid counts and nulls the rest", () => {
    expect(
      parseUsage({
        usage: { prompt_tokens: 120, completion_tokens: "x", total_tokens: -1 },
      }),
    ).toEqual({ prompt: 120, completion: null, total: null });
  });

  it.each([
    ["no usage", {}],
    ["null usage", { usage: null }],
    ["a non-object body", "text"],
    ["no body", undefined],
    ["only bad values", { usage: { prompt_tokens: 1.5, total_tokens: 1e30 } }],
    ["non-integer counts", { usage: { total_tokens: 12.5 } }],
  ])("AC-20: %s gives no usage", (_name, body) => {
    expect(parseUsage(body)).toBeNull();
  });
});

describe("parseLimits", () => {
  const headers = new Headers({
    "x-ratelimit-limit-requests": "500",
    "x-ratelimit-remaining-requests": "480",
    "x-ratelimit-reset-requests": "2m59.56s",
    "x-ratelimit-limit-tokens": "8000",
    "x-ratelimit-remaining-tokens": "6000",
    "x-ratelimit-reset-tokens": "7.66s",
  });

  it("AC-5, FR-6: reads figures and turns relative resets into absolute times", () => {
    expect(parseLimits(headers, 1_000_000)).toEqual({
      requests: { remaining: 480, limit: 500, resetsAt: 1_179_560 },
      tokens: { remaining: 6000, limit: 8000, resetsAt: 1_007_660 },
    });
  });

  it("AC-12: missing headers are null", () => {
    expect(parseLimits(new Headers(), 5)).toEqual({
      requests: { remaining: null, limit: null, resetsAt: null },
      tokens: { remaining: null, limit: null, resetsAt: null },
    });
  });

  it.each(["-1", "abc", "1.5", "", "99999999999999999999"])(
    "AC-20: a bad count %j is null",
    (bad) => {
      const limits = parseLimits(
        new Headers({
          "x-ratelimit-remaining-tokens": bad,
          "x-ratelimit-limit-tokens": "8000",
        }),
        0,
      );

      expect(limits.tokens).toEqual({
        remaining: null,
        limit: 8000,
        resetsAt: null,
      });
    },
  );

  it("AC-20: remaining above the limit drops both but keeps the reset", () => {
    const limits = parseLimits(
      new Headers({
        "x-ratelimit-remaining-requests": "600",
        "x-ratelimit-limit-requests": "500",
        "x-ratelimit-reset-requests": "10s",
      }),
      0,
    );

    expect(limits.requests).toEqual({
      remaining: null,
      limit: null,
      resetsAt: 10_000,
    });
  });

  it("tells whether any limit figure is present", () => {
    const answer = (limits: ReturnType<typeof parseLimits>) => ({
      receivedAt: 0,
      usage: null,
      limits,
    });

    expect(hasLimitFigure(answer(parseLimits(headers, 0)))).toBe(true);
    expect(hasLimitFigure(answer(parseLimits(new Headers(), 0)))).toBe(false);
  });
});
