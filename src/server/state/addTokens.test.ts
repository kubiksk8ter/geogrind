import { describe, expect, it } from "vitest";
import { addTokens, pruneState } from "./rules";
import { EMPTY_STATE, type StateData } from "./types";

const DAY_ONE = Date.UTC(2026, 10, 9, 12);
const DAY_TWO = Date.UTC(2026, 10, 10, 0, 0, 1);

const apply = (state: StateData, tokens: number, now: number) =>
  addTokens(state, tokens, now).next;

describe("addTokens", () => {
  it("AC-4: sums the totals of one UTC day", () => {
    const state = apply(apply(EMPTY_STATE, 150, DAY_ONE), 120, DAY_ONE + 1000);

    expect(state.daily).toEqual({ day: "2026-11-09", count: 0, tokens: 270 });
  });

  it("AC-4: starts again at 0 after UTC midnight", () => {
    const yesterday = apply(EMPTY_STATE, 150, DAY_ONE);

    expect(pruneState(yesterday, DAY_TWO).daily.tokens).toBe(0);
    expect(apply(yesterday, 40, DAY_TWO).daily).toEqual({
      day: "2026-11-10",
      count: 0,
      tokens: 40,
    });
  });

  it("resets tokens together with the cap counter and keeps both on the same day", () => {
    const state: StateData = {
      ...EMPTY_STATE,
      daily: { day: "2026-11-09", count: 37, tokens: 270 },
    };

    expect(pruneState(state, DAY_ONE).daily).toEqual(state.daily);
    expect(pruneState(state, DAY_TWO).daily).toEqual({
      day: "2026-11-10",
      count: 0,
      tokens: 0,
    });
  });
});
