import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCurrentTime } from "./useCurrentTime";

const at = (iso: string) => new Date(iso).getTime();

describe("useCurrentTime", () => {
  it("reads the clock again when the refresh key changes", () => {
    let time = at("2026-03-10T10:00:00");
    const clock = () => time;
    const { result, rerender } = renderHook(
      ({ key }) => useCurrentTime(key, clock),
      { initialProps: { key: 1 } },
    );
    expect(result.current).toBe(time);

    time = at("2026-03-10T11:00:00");
    rerender({ key: 2 });

    expect(result.current).toBe(time);
  });

  it("moves to the next day at midnight", () => {
    vi.useFakeTimers();
    try {
      let time = at("2026-03-10T23:59:00");
      const clock = () => time;
      const { result } = renderHook(() => useCurrentTime(0, clock));

      time = at("2026-03-11T00:00:00");
      act(() => vi.advanceTimersByTime(60_000));

      expect(result.current).toBe(time);
    } finally {
      vi.useRealTimers();
    }
  });
});
