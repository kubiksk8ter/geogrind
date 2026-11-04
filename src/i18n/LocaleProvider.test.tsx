import { act, cleanup, render, screen } from "@testing-library/react";
import { useTranslations } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocaleSwitch } from "./LocaleProvider";

function Probe() {
  const t = useTranslations("map");
  const { locale, setLocale } = useLocaleSwitch();
  return (
    <>
      <p data-testid="label">{t("label")}</p>
      <button type="button" onClick={() => setLocale("en")}>
        en
      </button>
      <button type="button" onClick={() => setLocale("cs")}>
        cs
      </button>
      <output>{locale}</output>
    </>
  );
}

function renderProbe(initial: "cs" | "en") {
  return render(
    <LocaleProvider initialLocale={initial}>
      <Probe />
    </LocaleProvider>,
  );
}

const cookieSet = vi.fn(() => Promise.resolve());

beforeEach(() => {
  cookieSet.mockClear();
  vi.stubGlobal("cookieStore", { set: cookieSet });
  window.history.replaceState(null, "", "/cs?x=1#top");
  document.documentElement.lang = "cs";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LocaleProvider", () => {
  it("AC-6: setLocale updates texts, URL, html lang and cookie without navigating", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const pushState = vi.spyOn(window.history, "pushState");
    renderProbe("cs");
    expect(screen.getByTestId("label").textContent).toBe(
      "Mapa České republiky",
    );

    act(() => screen.getByRole("button", { name: "en" }).click());

    expect(screen.getByTestId("label").textContent).toBe(
      "Map of the Czech Republic",
    );
    expect(window.location.pathname + window.location.search).toBe("/en?x=1");
    expect(window.location.hash).toBe("#top");
    expect(document.documentElement.lang).toBe("en");
    expect(cookieSet).toHaveBeenCalledExactlyOnceWith({
      name: "NEXT_LOCALE",
      value: "en",
      path: "/",
      sameSite: "lax",
    });
    expect(replaceState).toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("AC-9: selecting the active locale changes nothing", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderProbe("cs");
    replaceState.mockClear();

    act(() => screen.getByRole("button", { name: "cs" }).click());

    expect(replaceState).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/cs");
    expect(document.documentElement.lang).toBe("cs");
  });

  it("useLocaleSwitch fails outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow();
  });
});
