import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROTATION_INTERVAL_MS } from "./placeholderConstants";
import { usePlaceholderRotation } from "./usePlaceholderRotation";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const tick = () => act(() => vi.advanceTimersByTime(ROTATION_INTERVAL_MS));

describe("usePlaceholderRotation", () => {
  it("AC-3: advances in order and wraps around", () => {
    const { result } = renderHook(() =>
      usePlaceholderRotation({ count: 3, paused: false }),
    );

    expect(result.current).toBe(0);
    tick();
    expect(result.current).toBe(1);
    tick();
    expect(result.current).toBe(2);
    tick();
    expect(result.current).toBe(0);
  });

  it("AC-4: stops while paused and continues when resumed", () => {
    const { result, rerender } = renderHook(
      ({ paused }) => usePlaceholderRotation({ count: 3, paused }),
      { initialProps: { paused: false } },
    );
    tick();
    expect(result.current).toBe(1);

    rerender({ paused: true });
    tick();
    tick();
    expect(result.current).toBe(1);

    rerender({ paused: false });
    tick();
    expect(result.current).toBe(2);
  });
});
