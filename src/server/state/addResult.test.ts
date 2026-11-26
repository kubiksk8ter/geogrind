import { describe, expect, it } from "vitest";
import type { ResultKey } from "@/shared/metricsContract";
import { noResults } from "@/shared/metricsContract";
import { addResult, pruneState } from "./rules";
import { EMPTY_STATE, type StateData } from "./types";

const DAY_ONE = Date.UTC(2026, 10, 9, 12);
const DAY_TWO = Date.UTC(2026, 10, 10, 0, 0, 1);

const applyAll = (results: ResultKey[], now = DAY_ONE, start = EMPTY_STATE) =>
  results.reduce<StateData>(
    (state, result) => addResult(state, result, now).next,
    start,
  );

describe("addResult", () => {
  it("AC-2: counts today's commands by result", () => {
    const state = applyAll([
      ...Array<ResultKey>(6).fill("success"),
      "not_found",
      "not_found",
      "wait",
      "error",
    ]);

    expect(state.daily.results).toEqual({
      ...noResults(),
      success: 6,
      not_found: 2,
      wait: 1,
      error: 1,
    });
  });

  it("AC-19: starts again at 0 after UTC midnight, with the cap counter and tokens", () => {
    const yesterday = applyAll(["success", "error"]);

    expect(pruneState(yesterday, DAY_TWO).daily.results).toEqual(noResults());
    expect(addResult(yesterday, "wait", DAY_TWO).next.daily).toEqual({
      day: "2026-11-10",
      count: 0,
      tokens: 0,
      results: { ...noResults(), wait: 1 },
    });
  });
});
