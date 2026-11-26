import { describe, expect, it } from "vitest";
import { limitView, UNKNOWN_LIMIT } from "./limitView";

const figure = { remaining: 480, limit: 500, resetsAt: 10_000 };

describe("limitView", () => {
  it("shows the figure with a bar while the countdown runs", () => {
    expect(limitView(figure, 4_000)).toEqual({
      kind: "current",
      remaining: 480,
      bar: { remaining: 480, limit: 500 },
      resetInMs: 6_000,
    });
  });

  it("AC-8: at zero the limit counts as renewed and the old value is not current", () => {
    expect(limitView(figure, 10_000)).toEqual({ kind: "renewed" });
    expect(limitView(figure, 12_000)).toEqual({ kind: "renewed" });
  });

  it("AC-12: an unknown reset time does not renew and shows no countdown", () => {
    expect(limitView({ ...figure, resetsAt: null }, 99_999)).toMatchObject({
      kind: "current",
      resetInMs: null,
    });
  });

  it.each([
    ["remaining unknown", { ...figure, remaining: null }],
    ["limit unknown", { ...figure, limit: null }],
    ["a zero limit", { ...figure, remaining: 0, limit: 0 }],
    ["nothing known", UNKNOWN_LIMIT],
  ])("AC-12: no bar for %s", (_name, partial) => {
    expect(limitView(partial, 0)).toMatchObject({ bar: null });
  });
});
