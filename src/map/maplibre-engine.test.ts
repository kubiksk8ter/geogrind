import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event?: unknown) => void;

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, Handler>,
  remove: vi.fn(),
  addControl: vi.fn(),
  construct: vi.fn(),
  addImage: vi.fn(),
  fitBounds: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  setData: vi.fn(),
  setPaintProperty: vi.fn(),
  sourceReady: false,
  resolveMissingImage: undefined as ((id: string) => void) | undefined,
}));

vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(options: unknown) {
      mocks.construct(options);
    }
    addControl = mocks.addControl;
    on(event: string, handler: Handler) {
      mocks.handlers[event] = handler;
    }
    remove = mocks.remove;
    addImage = mocks.addImage;
    fitBounds = mocks.fitBounds;
    addSource = mocks.addSource;
    addLayer = mocks.addLayer;
    setPaintProperty = mocks.setPaintProperty;
    getSource() {
      return mocks.sourceReady ? { setData: mocks.setData } : undefined;
    }
    hasImage = vi.fn(() => false);
    setMissingStyleImageResolver(resolver: (id: string) => void) {
      mocks.resolveMissingImage = resolver;
    }
  },
  NavigationControl: class NavigationControl {},
  AttributionControl: class AttributionControl {},
  setWorkerUrl: vi.fn(),
}));

import type { Highlight } from "@/shared/highlightSchema";
import { MAP_CONFIG } from "./config";
import { HIGHLIGHT_SOURCE_ID } from "./highlightLayers";
import {
  createMapEngine,
  HIGHLIGHT_FADE_MS,
  HIGHLIGHT_LIFETIME_MS,
} from "./maplibre-engine";
import type { MapEngineOptions } from "./types";

const container = document.createElement("div");
const styleError = { error: new Error("style failed") };
const options = (overrides: Partial<MapEngineOptions> = {}) => ({
  container,
  onFailure: vi.fn(),
  onAvailabilityChange: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  mocks.handlers = {};
  mocks.construct.mockReset();
  mocks.remove.mockReset();
  mocks.addControl.mockReset();
  mocks.addImage.mockReset();
  mocks.fitBounds.mockReset();
  mocks.addSource.mockReset();
  mocks.addLayer.mockReset();
  mocks.setData.mockReset();
  mocks.setPaintProperty.mockReset();
  mocks.sourceReady = false;
  mocks.resolveMissingImage = undefined;
});
afterEach(() => vi.useRealTimers());

describe("createMapEngine", () => {
  it("AC-2: fits the Czech bounds with the configured style", () => {
    createMapEngine(options());

    expect(mocks.construct).toHaveBeenCalledWith(
      expect.objectContaining({
        container,
        style: MAP_CONFIG.styleUrl,
        bounds: MAP_CONFIG.czechBounds,
      }),
    );
  });

  it("FR-6: adds the controls slot after the zoom control", () => {
    const engine = createMapEngine(options());

    const [zoom, slot] = mocks.addControl.mock.calls.map(
      ([control]) => control,
    );
    expect(zoom.constructor.name).toBe("NavigationControl");
    expect(slot.onAdd()).toBe(engine.controlsSlot);
    expect(engine.controlsSlot.className).toContain("maplibregl-ctrl");
  });

  it("FR-15: shows the collapsible attribution in the top-left corner only", () => {
    createMapEngine(options());

    expect(mocks.construct).toHaveBeenCalledWith(
      expect.objectContaining({ attributionControl: false }),
    );
    const attribution = mocks.addControl.mock.calls.find(
      ([control]) => control.constructor.name === "AttributionControl",
    );
    expect(attribution?.[1]).toBe("top-left");
  });

  it("reports webgl failure when the map constructor throws", () => {
    mocks.construct.mockImplementation(() => {
      throw new Error("no webgl");
    });
    const onFailure = vi.fn();

    createMapEngine(options({ onFailure }));

    expect(onFailure).toHaveBeenCalledExactlyOnceWith("webgl");
  });

  it("AC-14: reports style failure once for an error before the style loaded", () => {
    const onFailure = vi.fn();
    createMapEngine(options({ onFailure }));

    mocks.handlers.error?.(styleError);
    mocks.handlers.error?.(styleError);

    expect(onFailure).toHaveBeenCalledExactlyOnceWith("style");
  });

  it("ignores errors after the style loaded (single tile errors)", () => {
    const onFailure = vi.fn();
    createMapEngine(options({ onFailure }));

    mocks.handlers["style.load"]?.();
    mocks.handlers.error?.(styleError);

    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports timeout when the map never finishes loading", () => {
    const onFailure = vi.fn();
    createMapEngine(options({ onFailure }));

    vi.advanceTimersByTime(MAP_CONFIG.loadTimeoutMs);

    expect(onFailure).toHaveBeenCalledExactlyOnceWith("timeout");
  });

  it("does not time out once the map has loaded", () => {
    const onFailure = vi.fn();
    createMapEngine(options({ onFailure }));

    mocks.handlers.load?.();
    vi.advanceTimersByTime(MAP_CONFIG.loadTimeoutMs);

    expect(onFailure).not.toHaveBeenCalled();
  });

  it("replaces icons missing from the style's sprite with a placeholder", () => {
    createMapEngine(options());

    mocks.resolveMissingImage?.("office");

    expect(mocks.addImage).toHaveBeenCalledWith(
      "office",
      expect.objectContaining({ width: 1, height: 1 }),
    );
  });

  describe("moveTo", () => {
    const target = {
      bounds: [
        [16.4, 49.1],
        [16.7, 49.3],
      ] satisfies [[number, number], [number, number]],
    };

    it("FR-2: fits the whole target with a capped zoom", () => {
      const engine = createMapEngine(options());

      engine.moveTo(target, "animate");

      expect(mocks.fitBounds).toHaveBeenCalledExactlyOnceWith(
        target.bounds,
        expect.objectContaining({ maxZoom: MAP_CONFIG.targetMaxZoom }),
      );
    });

    it("animates the move for normal motion", () => {
      const engine = createMapEngine(options());

      engine.moveTo(target, "animate");

      expect(mocks.fitBounds.mock.calls[0]?.[1]).toMatchObject({
        animate: true,
      });
    });

    it("AC-26: jumps instead of animating for reduced motion", () => {
      const engine = createMapEngine(options());

      engine.moveTo(target, "jump");

      expect(mocks.fitBounds.mock.calls[0]?.[1]).toMatchObject({
        animate: false,
      });
    });
  });

  describe("highlight", () => {
    const bounds = [
      [16.4, 49.1],
      [16.7, 49.3],
    ] satisfies [[number, number], [number, number]];
    const point: Highlight = { type: "Point", coordinates: [16.6, 49.2] };

    it("AC-1: adds the highlight source and its layers once the style has loaded", () => {
      createMapEngine(options());

      mocks.handlers["style.load"]?.();

      expect(mocks.addSource).toHaveBeenCalledExactlyOnceWith(
        HIGHLIGHT_SOURCE_ID,
        expect.objectContaining({ type: "geojson" }),
      );
      expect(mocks.addLayer.mock.calls.map(([layer]) => layer.type)).toEqual([
        "line",
        "line",
        "circle",
      ]);
    });

    it("AC-2: draws the point exactly where the server put it", () => {
      const engine = createMapEngine(options());
      mocks.handlers["style.load"]?.();
      mocks.sourceReady = true;

      engine.moveTo({ bounds, highlight: point }, "animate");

      expect(mocks.setData).toHaveBeenCalledExactlyOnceWith({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: point }],
      });
    });

    it("AC-1: a highlight asked for before the style loaded is drawn when it has", () => {
      const engine = createMapEngine(options());

      engine.moveTo({ bounds, highlight: point }, "animate");
      mocks.handlers["style.load"]?.();

      expect(mocks.setData).not.toHaveBeenCalled();
      expect(mocks.addSource.mock.calls[0]?.[1].data.features).toHaveLength(1);
    });

    it("AC-7: a target without a highlight leaves nothing drawn", () => {
      const engine = createMapEngine(options());
      mocks.handlers["style.load"]?.();
      mocks.sourceReady = true;
      engine.moveTo({ bounds, highlight: point }, "animate");

      engine.moveTo({ bounds }, "animate");

      expect(mocks.setData).toHaveBeenLastCalledWith({
        type: "FeatureCollection",
        features: [],
      });
    });

    it("AC-8: clearHighlight removes the highlight without moving the view", () => {
      const engine = createMapEngine(options());
      mocks.handlers["style.load"]?.();
      mocks.sourceReady = true;
      engine.moveTo({ bounds, highlight: point }, "animate");
      mocks.fitBounds.mockClear();

      engine.clearHighlight();

      expect(mocks.setData).toHaveBeenLastCalledWith({
        type: "FeatureCollection",
        features: [],
      });
      expect(mocks.fitBounds).not.toHaveBeenCalled();
    });
  });

  describe("highlight expiry", () => {
    const bounds = [
      [16.4, 49.1],
      [16.7, 49.3],
    ] satisfies [[number, number], [number, number]];
    const point: Highlight = { type: "Point", coordinates: [16.6, 49.2] };
    const otherPoint: Highlight = { type: "Point", coordinates: [14.4, 50.1] };
    const empty = { type: "FeatureCollection", features: [] };
    // The fade starts this long after the map stopped moving.
    const FADE_START_MS = HIGHLIGHT_LIFETIME_MS - HIGHLIGHT_FADE_MS;
    const opacityValues = () =>
      mocks.setPaintProperty.mock.calls
        .filter(([, property]) => !String(property).endsWith("-transition"))
        .map(([, , value]) => value);

    const setup = () => {
      const engine = createMapEngine(options());
      mocks.handlers["style.load"]?.();
      mocks.sourceReady = true;
      return engine;
    };

    it("AC-14: fades out for the fade time and is gone one lifetime after the map stopped moving", () => {
      const engine = setup();
      engine.moveTo({ bounds, highlight: point }, "animate");
      vi.advanceTimersByTime(HIGHLIGHT_LIFETIME_MS * 2);
      expect(mocks.setData).toHaveBeenCalledTimes(1);

      mocks.handlers.moveend?.();
      vi.advanceTimersByTime(FADE_START_MS - 1);
      expect(opacityValues()).not.toContain(0);

      vi.advanceTimersByTime(1);
      expect(opacityValues().slice(-4)).toEqual([0, 0, 0, 0]);
      expect(mocks.setPaintProperty).toHaveBeenCalledWith(
        "highlight-line",
        "line-opacity-transition",
        { duration: HIGHLIGHT_FADE_MS, delay: 0 },
      );
      expect(mocks.setData).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(HIGHLIGHT_FADE_MS);
      expect(mocks.setData).toHaveBeenLastCalledWith(empty);
    });

    it("AC-14: with reduced motion it disappears at once after the lifetime, without a fade", () => {
      const engine = setup();
      engine.moveTo({ bounds, highlight: point }, "jump");
      mocks.handlers.moveend?.();
      mocks.setPaintProperty.mockClear();

      vi.advanceTimersByTime(HIGHLIGHT_LIFETIME_MS - 1);
      expect(mocks.setData).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(mocks.setData).toHaveBeenLastCalledWith(empty);
      expect(mocks.setPaintProperty).not.toHaveBeenCalled();
    });

    it("AC-14: the delay starts only when the map stops moving, not at the command", () => {
      const engine = setup();
      engine.moveTo({ bounds, highlight: point }, "animate");

      vi.advanceTimersByTime(HIGHLIGHT_LIFETIME_MS * 2);

      expect(mocks.setData).toHaveBeenCalledTimes(1);
    });

    it("FR-11: moving the map by hand does not restart the delay", () => {
      const engine = setup();
      engine.moveTo({ bounds, highlight: point }, "jump");
      mocks.handlers.moveend?.();
      vi.advanceTimersByTime(HIGHLIGHT_LIFETIME_MS / 2);

      mocks.handlers.moveend?.();
      vi.advanceTimersByTime(HIGHLIGHT_LIFETIME_MS / 2);

      expect(mocks.setData).toHaveBeenLastCalledWith(empty);
    });

    it("AC-15: a new highlight cancels the pending fade and shows at full strength", () => {
      const engine = setup();
      engine.moveTo({ bounds, highlight: point }, "animate");
      mocks.handlers.moveend?.();
      vi.advanceTimersByTime(FADE_START_MS + 1);
      mocks.setPaintProperty.mockClear();

      engine.moveTo({ bounds, highlight: otherPoint }, "animate");

      expect(opacityValues()).toEqual([1, 1, 1, 1]);
      expect(mocks.setPaintProperty).toHaveBeenCalledWith(
        "highlight-point",
        "circle-stroke-opacity-transition",
        { duration: 0, delay: 0 },
      );
      mocks.handlers.moveend?.();
      vi.advanceTimersByTime(HIGHLIGHT_LIFETIME_MS - 1);
      expect(mocks.setData).not.toHaveBeenLastCalledWith(empty);

      vi.advanceTimersByTime(1);
      expect(mocks.setData).toHaveBeenLastCalledWith(empty);
    });

    it("AC-15: clearHighlight cancels the pending timer", () => {
      const engine = setup();
      engine.moveTo({ bounds, highlight: point }, "jump");
      mocks.handlers.moveend?.();
      engine.clearHighlight();
      mocks.setData.mockClear();

      vi.advanceTimersByTime(HIGHLIGHT_LIFETIME_MS * 2);

      expect(mocks.setData).not.toHaveBeenCalled();
    });
  });

  describe("map availability (spec 010)", () => {
    const loadedTile = { tile: {}, sourceId: "openmaptiles" };
    const failedTile = {
      error: new Error("Failed to fetch"),
      tile: {},
      sourceId: "openmaptiles",
    };

    const setup = () => {
      const onAvailabilityChange = vi.fn();
      const onFailure = vi.fn();
      createMapEngine(options({ onAvailabilityChange, onFailure }));
      mocks.handlers["style.load"]?.();
      return { onAvailabilityChange, onFailure };
    };
    const fail = (times: number, event: object = failedTile) => {
      for (let i = 0; i < times; i++) mocks.handlers.error?.(event);
    };

    it("is unknown at the start and available with the first loaded tile", () => {
      const { onAvailabilityChange } = setup();
      expect(onAvailabilityChange).not.toHaveBeenCalled();

      mocks.handlers.sourcedata?.(loadedTile);

      expect(onAvailabilityChange).toHaveBeenCalledExactlyOnceWith("available");
    });

    it("source events without a tile (metadata) say nothing", () => {
      const { onAvailabilityChange } = setup();

      mocks.handlers.sourcedata?.({ sourceId: "openmaptiles" });

      expect(onAvailabilityChange).not.toHaveBeenCalled();
    });

    it("AC-9: one failed tile is ignored, three in a row make the map unavailable", () => {
      const { onAvailabilityChange, onFailure } = setup();
      mocks.handlers.sourcedata?.(loadedTile);

      fail(1);
      expect(onAvailabilityChange).toHaveBeenLastCalledWith("available");

      fail(2);
      expect(onAvailabilityChange).toHaveBeenLastCalledWith("unavailable");
      expect(onFailure).not.toHaveBeenCalled();
    });

    it("AC-9: a loaded tile makes it available again", () => {
      const { onAvailabilityChange } = setup();
      fail(3);

      mocks.handlers.sourcedata?.(loadedTile);

      expect(onAvailabilityChange.mock.calls).toEqual([
        ["unavailable"],
        ["available"],
      ]);
    });

    it("a missing tile (404) is not an error", () => {
      const { onAvailabilityChange } = setup();
      const missing = Object.assign(new Error("Not Found"), { status: 404 });

      fail(5, { ...failedTile, error: missing });

      expect(onAvailabilityChange).not.toHaveBeenCalled();
    });

    it("style, glyph and sprite errors without a tile are ignored", () => {
      const { onAvailabilityChange } = setup();

      fail(5, { error: new Error("glyphs failed") });

      expect(onAvailabilityChange).not.toHaveBeenCalled();
    });

    it("the locally drawn highlight source neither fails nor rescues the map", () => {
      const { onAvailabilityChange } = setup();
      fail(3);

      mocks.handlers.sourcedata?.({ tile: {}, sourceId: HIGHLIGHT_SOURCE_ID });

      expect(onAvailabilityChange.mock.calls).toEqual([["unavailable"]]);
    });
  });

  it("destroy removes the map and cancels the timeout", () => {
    const onFailure = vi.fn();
    const engine = createMapEngine(options({ onFailure }));

    engine.destroy();
    vi.advanceTimersByTime(MAP_CONFIG.loadTimeoutMs);

    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });
});
