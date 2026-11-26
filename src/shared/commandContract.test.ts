import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { commandRequestSchema, commandResponseSchema } from "./commandContract";

const parseRequest = (body: unknown) =>
  v.safeParse(commandRequestSchema, body).success;

describe("command request schema", () => {
  it("accepts clean text with a known locale", () => {
    expect(parseRequest({ text: "Zoom to Brno", locale: "en" })).toBe(true);
  });

  it.each([
    ["missing text", { locale: "cs" }],
    ["missing locale", { text: "Brno" }],
    ["non-text text", { text: 5, locale: "cs" }],
    ["unknown locale", { text: "Brno", locale: "de" }],
    ["extra field", { text: "Brno", locale: "cs", admin: true }],
    ["unclean text", { text: "Brno\n", locale: "cs" }],
    ["empty text", { text: "", locale: "cs" }],
    ["not an object", "Brno"],
    ["an array", [{ text: "Brno", locale: "cs" }]],
  ])("AC-4, AC-6: rejects %s", (_name, body) => {
    expect(parseRequest(body)).toBe(false);
  });
});

describe("command response schema", () => {
  const parse = (body: unknown) => v.safeParse(commandResponseSchema, body);

  it("accepts a success", () => {
    expect(
      parse({
        ok: true,
        result: {
          action: "zoom_to_place",
          bounds: [
            [16, 49],
            [17, 50],
          ],
        },
        cooldownSeconds: 10,
      }).success,
    ).toBe(true);
  });

  const success = (highlight: unknown) => ({
    ok: true,
    result: {
      action: "zoom_to_place",
      bounds: [
        [16, 49],
        [17, 50],
      ],
      highlight,
    },
    cooldownSeconds: 10,
  });

  it("accepts a success with a highlight", () => {
    expect(
      parse(success({ type: "Point", coordinates: [16.5, 49.5] })).success,
    ).toBe(true);
  });

  it.each([
    ["an unknown geometry type", { type: "Circle", coordinates: [1, 2] }],
    ["a point out of range", { type: "Point", coordinates: [16, 99] }],
    [
      "an unclosed ring",
      {
        type: "Polygon",
        coordinates: [
          [
            [1, 2],
            [3, 4],
          ],
        ],
      },
    ],
  ])("rejects a highlight with %s", (_name, highlight) => {
    expect(parse(success(highlight)).success).toBe(false);
  });

  it.each([
    [{ code: "wait", retryAfterSeconds: 4 }],
    [{ code: "ai_resting", resetAt: "2026-11-10T00:00:00.000Z" }],
    [{ code: "error" }],
  ])("accepts the failure %j", (error) => {
    expect(parse({ ok: false, error }).success).toBe(true);
  });

  it.each([
    ["unknown code", { ok: false, error: { code: "teapot" } }],
    [
      "failure with a message",
      { ok: false, error: { code: "error", message: "x" } },
    ],
    ["success without result", { ok: true, cooldownSeconds: 10 }],
    ["not an object", "ok"],
  ])("rejects %s", (_name, body) => {
    expect(parse(body).success).toBe(false);
  });
});
