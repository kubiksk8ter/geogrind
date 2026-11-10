import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/routing";
import type { CreateMapEngine, MapEngine, MapEngineOptions } from "@/map";
import { MapView } from "./MapView";

beforeEach(() => {
  vi.stubGlobal("cookieStore", { set: () => Promise.resolve() });
  window.localStorage.clear();
  window.history.replaceState(null, "", "/cs");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fakeSlot() {
  const slot = document.createElement("div");
  document.body.append(slot);
  return slot;
}

function renderMap(locale: Locale, createEngine: CreateMapEngine) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <MapView createEngine={createEngine} />
    </LocaleProvider>,
  );
}

function setup(locale: Locale = "cs") {
  const destroy = vi.fn();
  const moveTo = vi.fn<MapEngine["moveTo"]>();
  const calls: MapEngineOptions[] = [];
  const createEngine = vi.fn<CreateMapEngine>((options) => {
    calls.push(options);
    return { controlsSlot: fakeSlot(), moveTo, destroy };
  });
  return {
    ...renderMap(locale, createEngine),
    calls,
    destroy,
    createEngine,
    moveTo,
  };
}

describe("MapView", () => {
  it("creates the engine once with a container and destroys it on unmount", () => {
    const { calls, destroy, unmount } = setup();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.container).toBeInstanceOf(HTMLElement);
    expect(destroy).not.toHaveBeenCalled();

    unmount();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it.each([
    ["cs", "Mapa"],
    ["en", "Map"],
  ] as const)("AC-8: names the map region in %s", (locale, name) => {
    setup(locale);

    expect(screen.getByRole("region", { name })).toBeDefined();
  });

  it("FR-6: renders the language switch into the engine's controls slot", () => {
    const slot = fakeSlot();
    renderMap("cs", () => ({
      controlsSlot: slot,
      moveTo: vi.fn(),
      destroy: vi.fn(),
    }));

    expect(slot.contains(screen.getByRole("radiogroup"))).toBe(true);
  });

  it("AC-1: shows the command input on top of the map", () => {
    setup("en");

    expect(screen.getByRole("textbox", { name: "Map command" })).toBeDefined();
  });

  it("AC-6, AC-7: switching language keeps the engine and renames the map", () => {
    const { createEngine, destroy } = setup("cs");

    act(() => screen.getByRole("radio", { name: "Angličtina" }).click());

    expect(screen.getByRole("region", { name: "Map" })).toBeDefined();
    expect(createEngine).toHaveBeenCalledOnce();
    expect(destroy).not.toHaveBeenCalled();
  });

  it.each([
    ["cs", "Mapu se nepodařilo načíst. Zkuste stránku načíst znovu."],
    ["en", "The map could not be loaded. Please try reloading the page."],
  ] as const)(
    "AC-11: shows an alert in %s, destroys the engine and shows no switch on failure",
    (locale, text) => {
      const { calls, destroy } = setup(locale);

      act(() => calls[0]?.onFailure("style"));

      expect(screen.getByRole("alert").textContent).toBe(text);
      expect(screen.queryByRole("region")).toBeNull();
      expect(screen.queryByRole("radiogroup")).toBeNull();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(destroy).toHaveBeenCalledOnce();
    },
  );

  it("shows the failure message when the engine fails during creation", () => {
    renderMap("en", ({ onFailure }) => {
      onFailure("webgl");
      return {
        controlsSlot: document.createElement("div"),
        moveTo: vi.fn(),
        destroy: vi.fn(),
      };
    });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  describe("command wiring", () => {
    const BOUNDS = [
      [16.4, 49.1],
      [16.7, 49.3],
    ];

    function stubEnvironment(reducedMotion: boolean) {
      vi.stubGlobal("fetch", async () =>
        Response.json({
          ok: true,
          result: { action: "zoom_to_place", bounds: BOUNDS },
          cooldownSeconds: 10,
        }),
      );
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: reducedMotion && query.includes("prefers-reduced-motion"),
      }));
    }

    async function zoomToBrno() {
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Zoom to Brno" } });
      const form = input.closest("form");
      if (!form) throw new Error("no form");
      await act(async () => {
        fireEvent.submit(form);
      });
    }

    it("AC-1: a successful command moves the map with an animation", async () => {
      const { moveTo } = setup("en");
      stubEnvironment(false);

      await zoomToBrno();

      expect(moveTo).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ bounds: BOUNDS }),
        "animate",
      );
    });

    it("AC-26: with reduced motion the map jumps", async () => {
      const { moveTo } = setup("en");
      stubEnvironment(true);

      await zoomToBrno();

      expect(moveTo).toHaveBeenCalledExactlyOnceWith(expect.anything(), "jump");
    });
  });
});
