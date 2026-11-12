import {
  AttributionControl,
  type GeoJSONSource,
  type IControl,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import type { Highlight } from "@/shared/highlightSchema";
import { MAP_CONFIG } from "./config";
import {
  HIGHLIGHT_LAYERS,
  HIGHLIGHT_OPACITY_PROPERTIES,
  HIGHLIGHT_SOURCE_ID,
  highlightData,
} from "./highlightLayers";
import type { CreateMapEngine, MapEngine } from "./types";

// Bundlers rewrite import.meta.url inside maplibre-gl, so its default worker
// location cannot be derived; point it at the emitted worker asset explicitly.
setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

const FIT_PADDING_PX = 8;
// Keeps a target clear of the command input (bottom) and the map controls (right).
const TARGET_PADDING_PX = { top: 32, right: 56, bottom: 88, left: 32 };

// How long a highlight stays after the map has reached it; the last part of it is the fade-out.
export const HIGHLIGHT_LIFETIME_MS = 30_000;
export const HIGHLIGHT_FADE_MS = 5000;

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
    return {
      controlsSlot: document.createElement("div"),
      moveTo() {},
      clearHighlight() {},
      destroy() {},
    };
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
  // Kept so a highlight requested before the style has loaded is drawn once it has.
  let highlight: Highlight | undefined;
  let highlightMotion: "animate" | "jump" = "animate";
  // True from asking for a highlight until the map has finished moving to it; the expiry
  // delay counts from then, and later (manual) moves must not restart it.
  let awaitingMoveEnd = false;
  let expiryTimerId: number | undefined;

  const drawHighlight = () => {
    map
      .getSource<GeoJSONSource>(HIGHLIGHT_SOURCE_ID)
      ?.setData(highlightData(highlight));
  };
  const setHighlightOpacity = (opacity: number, fadeMs: number) => {
    if (!styleLoaded) return;
    for (const [layerId, property] of HIGHLIGHT_OPACITY_PROPERTIES) {
      map.setPaintProperty(layerId, `${property}-transition`, {
        duration: fadeMs,
        delay: 0,
      });
      map.setPaintProperty(layerId, property, opacity);
    }
  };
  const cancelExpiry = () => {
    awaitingMoveEnd = false;
    window.clearTimeout(expiryTimerId);
  };
  const removeHighlight = () => {
    highlight = undefined;
    drawHighlight();
  };
  const startExpiry = () => {
    if (highlightMotion === "jump") {
      expiryTimerId = window.setTimeout(removeHighlight, HIGHLIGHT_LIFETIME_MS);
      return;
    }
    expiryTimerId = window.setTimeout(() => {
      setHighlightOpacity(0, HIGHLIGHT_FADE_MS);
      expiryTimerId = window.setTimeout(removeHighlight, HIGHLIGHT_FADE_MS);
    }, HIGHLIGHT_LIFETIME_MS - HIGHLIGHT_FADE_MS);
  };
  const showHighlight = (
    next: Highlight | undefined,
    motion: "animate" | "jump",
  ) => {
    cancelExpiry();
    setHighlightOpacity(1, 0);
    highlight = next;
    highlightMotion = motion;
    awaitingMoveEnd = next !== undefined;
    drawHighlight();
  };
  map.on("moveend", () => {
    if (!awaitingMoveEnd) return;
    awaitingMoveEnd = false;
    startExpiry();
  });
  map.on("style.load", () => {
    styleLoaded = true;
    map.addSource(HIGHLIGHT_SOURCE_ID, {
      type: "geojson",
      data: highlightData(highlight),
    });
    for (const layer of HIGHLIGHT_LAYERS) map.addLayer(layer);
  });
  map.on("load", settle);
  // Errors after the style has loaded are single tile/glyph errors; MapLibre retries them.
  map.on("error", () => {
    if (!styleLoaded) fail("style");
  });

  const engine: MapEngine = {
    controlsSlot: slotControl.element,
    moveTo({ bounds, highlight: next }, motion) {
      showHighlight(next, motion);
      map.fitBounds(bounds, {
        padding: TARGET_PADDING_PX,
        maxZoom: MAP_CONFIG.targetMaxZoom,
        animate: motion === "animate",
      });
    },
    clearHighlight() {
      showHighlight(undefined, "jump");
    },
    destroy() {
      cancelExpiry();
      settle();
      map.remove();
    },
  };
  return engine;
};
