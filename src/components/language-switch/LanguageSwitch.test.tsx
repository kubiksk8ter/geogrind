import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/routing";
import { LanguageSwitch } from "./LanguageSwitch";

beforeEach(() => {
  vi.stubGlobal("cookieStore", { set: () => Promise.resolve() });
  window.history.replaceState(null, "", "/cs");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderSwitch(locale: Locale) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <LanguageSwitch />
    </LocaleProvider>,
  );
}

describe("LanguageSwitch", () => {
  it.each([
    ["cs", "Jazyk", "Čeština", "Angličtina"],
    ["en", "Language", "Czech", "English"],
  ] as const)(
    "AC-10: names the group and options in %s",
    (locale, group, cs, en) => {
      renderSwitch(locale);

      expect(screen.getByRole("radiogroup", { name: group })).toBeDefined();
      expect(screen.getByRole("radio", { name: cs })).toBeDefined();
      expect(screen.getByRole("radio", { name: en })).toBeDefined();
    },
  );

  it("NFR-2: shows CZ and EN in both languages", () => {
    renderSwitch("en");

    expect(screen.getByRole("radio", { name: "Czech" }).textContent).toBe("CZ");
    expect(screen.getByRole("radio", { name: "English" }).textContent).toBe(
      "EN",
    );
  });

  it("FR-6: marks the active language as selected", () => {
    renderSwitch("cs");

    expect(
      screen
        .getByRole("radio", { name: "Čeština" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "Angličtina" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("AC-6: clicking the other language switches texts and address", () => {
    renderSwitch("cs");

    fireEvent.click(screen.getByRole("radio", { name: "Angličtina" }));

    expect(screen.getByRole("radiogroup", { name: "Language" })).toBeDefined();
    expect(window.location.pathname).toBe("/en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("AC-9: clicking the active language changes nothing", () => {
    renderSwitch("cs");

    fireEvent.click(screen.getByRole("radio", { name: "Čeština" }));

    expect(window.location.pathname).toBe("/cs");
    expect(screen.getByRole("radiogroup", { name: "Jazyk" })).toBeDefined();
  });

  it("AC-14: the language can be switched with the keyboard", async () => {
    renderSwitch("cs");

    const selected = screen.getByRole("radio", { name: "Čeština" });
    selected.focus();
    fireEvent.keyDown(selected, { key: "ArrowDown" });

    await waitFor(() => expect(window.location.pathname).toBe("/en"));
    expect(screen.getByRole("radiogroup", { name: "Language" })).toBeDefined();
  });
});
