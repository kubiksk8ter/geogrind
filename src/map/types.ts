export type MapFailureReason = "webgl" | "style" | "timeout";

export interface MapEngine {
  /** Element inside MapLibre's top-right control stack, after the zoom buttons. */
  readonly controlsSlot: HTMLElement;
  destroy(): void;
}

export interface MapEngineOptions {
  container: HTMLElement;
  onFailure: (reason: MapFailureReason) => void;
}

export type CreateMapEngine = (options: MapEngineOptions) => MapEngine;
