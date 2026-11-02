import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreateMapEngine, MapEngineOptions } from "@/map";
import cs from "../../messages/cs.json";
import en from "../../messages/en.json";
import { MapView } from "./MapView";

afterEach(cleanup);

const messages = { cs, en };

function renderMap(locale: "cs" | "en", createEngine: CreateMapEngine) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <MapView createEngine={createEngine} />
    </NextIntlClientProvider>,
  );
}

function setup(locale: "cs" | "en" = "cs") {
  const destroy = vi.fn();
  const calls: MapEngineOptions[] = [];
  const createEngine: CreateMapEngine = (options) => {
    calls.push(options);
    return { destroy };
  };
  return { ...renderMap(locale, createEngine), calls, destroy };
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
    ["cs", "Mapa České republiky"],
    ["en", "Map of the Czech Republic"],
  ] as const)("AC-8: names the map region in %s", (locale, name) => {
    setup(locale);

    expect(screen.getByRole("region", { name })).toBeDefined();
  });

  it.each([
    ["cs", "Mapu se nepodařilo načíst. Zkuste stránku načíst znovu."],
    ["en", "The map could not be loaded. Please try reloading the page."],
  ] as const)(
    "AC-14/AC-16: shows an alert in %s and destroys the engine on failure",
    (locale, text) => {
      const { calls, destroy } = setup(locale);

      act(() => calls[0]?.onFailure("style"));

      expect(screen.getByRole("alert").textContent).toBe(text);
      expect(screen.queryByRole("region")).toBeNull();
      expect(destroy).toHaveBeenCalledOnce();
    },
  );

  it("shows the failure message when the engine fails during creation", () => {
    renderMap("en", ({ onFailure }) => {
      onFailure("webgl");
      return { destroy: vi.fn() };
    });

    expect(screen.getByRole("alert")).toBeDefined();
  });
});
