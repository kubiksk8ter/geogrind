import { useEffect, useState } from "react";
import { ROTATION_INTERVAL_MS } from "./placeholderConstants";

// Returns the index of the current hint; it advances in a loop while not paused.
export function usePlaceholderRotation({
  count,
  paused,
}: {
  count: number;
  paused: boolean;
}): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused || count < 2) return;

    const timerId = window.setInterval(
      () => setIndex((current) => (current + 1) % count),
      ROTATION_INTERVAL_MS,
    );
    return () => window.clearInterval(timerId);
  }, [count, paused]);

  return index;
}
