export type MapFailureReason = "webgl" | "style" | "timeout";

export interface MapEngine {
  destroy(): void;
}

export interface MapEngineOptions {
  container: HTMLElement;
  onFailure: (reason: MapFailureReason) => void;
}

export type CreateMapEngine = (options: MapEngineOptions) => MapEngine;
