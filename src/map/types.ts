import type { Bounds } from "@/shared/actions";
import type { Highlight } from "@/shared/highlightSchema";

export type MapFailureReason = "webgl" | "style" | "timeout";

/** Whether this browser gets map tiles; known from the map's own tile loading only. */
export type MapAvailability = "unknown" | "available" | "unavailable";

export interface MapTarget {
  /** [[west, south], [east, north]] */
  bounds: Bounds;
  /** The found object to draw; without it the map shows no highlight. */
  highlight?: Highlight | undefined;
}

export interface MapEngine {
  /** Element inside MapLibre's top-right control stack, after the zoom buttons. */
  readonly controlsSlot: HTMLElement;
  /**
   * Moves the view so the whole target is visible and shows its highlight, replacing the
   * previous one; "jump" skips the animation.
   */
  moveTo(target: MapTarget, motion: "animate" | "jump"): void;
  /** Removes the highlight, if any. */
  clearHighlight(): void;
  destroy(): void;
}

export interface MapEngineOptions {
  container: HTMLElement;
  onFailure: (reason: MapFailureReason) => void;
  /** Called on every change only, never with the same value twice in a row. */
  onAvailabilityChange: (availability: MapAvailability) => void;
}

export type CreateMapEngine = (options: MapEngineOptions) => MapEngine;
