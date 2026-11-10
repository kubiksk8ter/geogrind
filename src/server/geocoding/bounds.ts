import type { Bounds } from "@/shared/command/actions";

// A point-like result (a single node) has no extent; the map still needs a box to fit.
export const DEFAULT_MIN_SPAN_DEGREES = 0.01;
// A landmark is a single object (a tower, a monument), so it gets a closer view than a town.
export const LANDMARK_MIN_SPAN_DEGREES = 0.002;

function widen(low: number, high: number, minSpan: number): [number, number] {
  if (high - low >= minSpan) return [low, high];
  const middle = (low + high) / 2;
  return [middle - minSpan / 2, middle + minSpan / 2];
}

export function ensureMinimumSize(
  [[west, south], [east, north]]: Bounds,
  minSpan: number = DEFAULT_MIN_SPAN_DEGREES,
): Bounds {
  const [wideWest, wideEast] = widen(west, east, minSpan);
  const [wideSouth, wideNorth] = widen(south, north, minSpan);
  return [
    [wideWest, wideSouth],
    [wideEast, wideNorth],
  ];
}
