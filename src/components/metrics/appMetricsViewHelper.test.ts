import { describe, expect, it } from "vitest";
import {
  isPartialWindow,
  resultEntries,
  serviceState,
  windowSpanMinutes,
} from "./appMetricsViewHelper";

const HOUR = 3_600_000;
const window = { startedAt: 1_000_000, durationMs: HOUR, bucketMs: 300_000 };

describe("application view rules", () => {
  it("NFR-7: the window is partial for the first hour after the start", () => {
    expect(isPartialWindow(window, window.startedAt + 59 * 60_000)).toBe(true);
    expect(isPartialWindow(window, window.startedAt + HOUR)).toBe(false);
  });

  it("the covered span is the time since the start, at most the hour, at least a minute", () => {
    expect(windowSpanMinutes(window, window.startedAt)).toBe(1);
    expect(windowSpanMinutes(window, window.startedAt + 12.5 * 60_000)).toBe(
      13,
    );
    expect(windowSpanMinutes(window, window.startedAt + 5 * HOUR)).toBe(60);
  });

  it("FR-2: lists all seven results in order, zeros included", () => {
    expect(
      resultEntries({
        success: 6,
        unsupported: 0,
        not_found: 2,
        wait: 1,
        too_many_requests: 0,
        ai_resting: 0,
        error: 1,
      }).map(({ count }) => count),
    ).toEqual([6, 0, 2, 1, 0, 0, 1]);
  });

  it("FR-10: an unknown service is neither available nor unavailable", () => {
    expect(serviceState(null)).toBe("unknown");
    expect(serviceState(true)).toBe("available");
    expect(serviceState(false)).toBe("unavailable");
  });
});
