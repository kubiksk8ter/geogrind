import type { MapAvailability } from "./types";

export interface TileAvailabilityOptions {
  /** Consecutive tile errors, with no success between them, that make the map unavailable. */
  failureThreshold: number;
  onChange(availability: MapAvailability): void;
}

export interface TileAvailability {
  tileLoaded(): void;
  tileFailed(): void;
}

/**
 * Unknown until the first tile has loaded. A single transient error never turns it unavailable,
 * and any loaded tile makes it available again at once.
 */
export function createTileAvailability({
  failureThreshold,
  onChange,
}: TileAvailabilityOptions): TileAvailability {
  let current: MapAvailability = "unknown";
  let failuresInRow = 0;

  const change = (next: MapAvailability) => {
    if (next === current) return;
    current = next;
    onChange(next);
  };

  return {
    tileLoaded() {
      failuresInRow = 0;
      change("available");
    },
    tileFailed() {
      failuresInRow += 1;
      if (failuresInRow >= failureThreshold) change("unavailable");
    },
  };
}
