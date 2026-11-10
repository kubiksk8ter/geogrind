import type { Bounds } from "@/shared/command/actions";

// A point-like result (a single node) has no extent; the map still needs a box to fit.
const MIN_SPAN_DEGREES = 0.01;

function widen(low: number, high: number): [number, number] {
  if (high - low >= MIN_SPAN_DEGREES) return [low, high];
  const middle = (low + high) / 2;
  return [middle - MIN_SPAN_DEGREES / 2, middle + MIN_SPAN_DEGREES / 2];
}

export function ensureMinimumSize([
  [west, south],
  [east, north],
]: Bounds): Bounds {
  const [wideWest, wideEast] = widen(west, east);
  const [wideSouth, wideNorth] = widen(south, north);
  return [
    [wideWest, wideSouth],
    [wideEast, wideNorth],
  ];
}
