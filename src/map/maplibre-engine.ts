import {
  AttributionControl,
  type IControl,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import { MAP_CONFIG } from "./config";
import type { CreateMapEngine, MapEngine } from "./types";

// Bundlers rewrite import.meta.url inside maplibre-gl, so its default worker
// location cannot be derived; point it at the emitted worker asset explicitly.
setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

const FIT_PADDING_PX = 8;

// The provider's style references a few icons its sprite does not contain; a transparent
// placeholder hides them instead of logging a warning for each one.
const EMPTY_IMAGE = { width: 1, height: 1, data: new Uint8Array(4) };

// An empty slot in MapLibre's control stack; MapLibre lays controls of a corner out vertically,
// so whatever is rendered into it sits below the controls added before.
class SlotControl implements IControl {
  readonly element = document.createElement("div");

  constructor() {
    this.element.className = "maplibregl-ctrl";
  }

  onAdd() {
    return this.element;
  }

  onRemove() {
    this.element.remove();
  }
}

export const createMapEngine: CreateMapEngine = ({ container, onFailure }) => {
  let map: MapLibreMap;
  try {
    map = new MapLibreMap({
      container,
      style: MAP_CONFIG.styleUrl,
      bounds: MAP_CONFIG.czechBounds,
      attributionControl: false,
      fitBoundsOptions: { padding: FIT_PADDING_PX },
    });
  } catch {
    onFailure("webgl");
    return { controlsSlot: document.createElement("div"), destroy() {} };
  }

  let settled = false;
  let styleLoaded = false;

  const settle = () => {
    settled = true;
    window.clearTimeout(timeoutId);
  };
  const fail = (reason: Parameters<typeof onFailure>[0]) => {
    if (settled) return;
    settle();
    onFailure(reason);
  };

  const timeoutId = window.setTimeout(
    () => fail("timeout"),
    MAP_CONFIG.loadTimeoutMs,
  );

  const slotControl = new SlotControl();
  map.addControl(new NavigationControl({ showCompass: false }));
  map.addControl(slotControl);
  // Top-left keeps the collapsible attribution clear of the bottom input and the right-hand controls.
  map.addControl(new AttributionControl(), "top-left");
  map.setMissingStyleImageResolver((id) => {
    if (!map.hasImage(id)) map.addImage(id, EMPTY_IMAGE);
  });
  map.on("style.load", () => {
    styleLoaded = true;
  });
  map.on("load", settle);
  // Errors after the style has loaded are single tile/glyph errors; MapLibre retries them.
  map.on("error", () => {
    if (!styleLoaded) fail("style");
  });

  const engine: MapEngine = {
    controlsSlot: slotControl.element,
    destroy() {
      settle();
      map.remove();
    },
  };
  return engine;
};
