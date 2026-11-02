import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = () => void;

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, Handler>,
  remove: vi.fn(),
  construct: vi.fn(),
  addImage: vi.fn(),
  resolveMissingImage: undefined as ((id: string) => void) | undefined,
}));

vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(options: unknown) {
      mocks.construct(options);
    }
    addControl = vi.fn();
    on(event: string, handler: Handler) {
      mocks.handlers[event] = handler;
    }
    remove = mocks.remove;
    addImage = mocks.addImage;
    hasImage = vi.fn(() => false);
    setMissingStyleImageResolver(resolver: (id: string) => void) {
      mocks.resolveMissingImage = resolver;
    }
  },
  NavigationControl: class {},
  setWorkerUrl: vi.fn(),
}));

import { MAP_CONFIG } from "./config";
import { createMapEngine } from "./maplibre-engine";

const container = document.createElement("div");

beforeEach(() => {
  vi.useFakeTimers();
  mocks.handlers = {};
  mocks.construct.mockReset();
  mocks.remove.mockReset();
  mocks.addImage.mockReset();
  mocks.resolveMissingImage = undefined;
});
afterEach(() => vi.useRealTimers());

describe("createMapEngine", () => {
  it("AC-2: fits the Czech bounds with the configured style", () => {
    createMapEngine({ container, onFailure: vi.fn() });

    expect(mocks.construct).toHaveBeenCalledWith(
      expect.objectContaining({
        container,
        style: MAP_CONFIG.styleUrl,
        bounds: MAP_CONFIG.czechBounds,
      }),
    );
  });

  it("reports webgl failure when the map constructor throws", () => {
    mocks.construct.mockImplementation(() => {
      throw new Error("no webgl");
    });
    const onFailure = vi.fn();

    createMapEngine({ container, onFailure });

    expect(onFailure).toHaveBeenCalledExactlyOnceWith("webgl");
  });

  it("AC-14: reports style failure once for an error before the style loaded", () => {
    const onFailure = vi.fn();
    createMapEngine({ container, onFailure });

    mocks.handlers.error?.();
    mocks.handlers.error?.();

    expect(onFailure).toHaveBeenCalledExactlyOnceWith("style");
  });

  it("ignores errors after the style loaded (single tile errors)", () => {
    const onFailure = vi.fn();
    createMapEngine({ container, onFailure });

    mocks.handlers["style.load"]?.();
    mocks.handlers.error?.();

    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports timeout when the map never finishes loading", () => {
    const onFailure = vi.fn();
    createMapEngine({ container, onFailure });

    vi.advanceTimersByTime(MAP_CONFIG.loadTimeoutMs);

    expect(onFailure).toHaveBeenCalledExactlyOnceWith("timeout");
  });

  it("does not time out once the map has loaded", () => {
    const onFailure = vi.fn();
    createMapEngine({ container, onFailure });

    mocks.handlers.load?.();
    vi.advanceTimersByTime(MAP_CONFIG.loadTimeoutMs);

    expect(onFailure).not.toHaveBeenCalled();
  });

  it("replaces icons missing from the style's sprite with a placeholder", () => {
    createMapEngine({ container, onFailure: vi.fn() });

    mocks.resolveMissingImage?.("office");

    expect(mocks.addImage).toHaveBeenCalledWith(
      "office",
      expect.objectContaining({ width: 1, height: 1 }),
    );
  });

  it("destroy removes the map and cancels the timeout", () => {
    const onFailure = vi.fn();
    const engine = createMapEngine({ container, onFailure });

    engine.destroy();
    vi.advanceTimersByTime(MAP_CONFIG.loadTimeoutMs);

    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });
});
