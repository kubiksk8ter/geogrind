import type { Bounds } from "@/shared/command/actions";

export type MapFailureReason = "webgl" | "style" | "timeout";

export interface MapTarget {
  /** [[west, south], [east, north]] */
  bounds: Bounds;
}

export interface MapEngine {
  /** Element inside MapLibre's top-right control stack, after the zoom buttons. */
  readonly controlsSlot: HTMLElement;
  /** Moves the view so the whole target is visible; "jump" skips the animation. */
  moveTo(target: MapTarget, motion: "animate" | "jump"): void;
  destroy(): void;
}

export interface MapEngineOptions {
  container: HTMLElement;
  onFailure: (reason: MapFailureReason) => void;
}

export type CreateMapEngine = (options: MapEngineOptions) => MapEngine;
