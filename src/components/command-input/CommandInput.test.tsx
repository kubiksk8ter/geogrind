import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocaleSwitch } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/routing";
import { CommandInput } from "./CommandInput";
import { ROTATION_INTERVAL_MS } from "./placeholderConstants";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("cookieStore", { set: () => Promise.resolve() });
  window.history.replaceState(null, "", "/cs");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function SwitchToEnglish() {
  const { setLocale } = useLocaleSwitch();
  return (
    <button type="button" onClick={() => setLocale("en")}>
      switch
    </button>
  );
}

function renderInput(locale: Locale) {
  render(
    <LocaleProvider initialLocale={locale}>
      <CommandInput />
      <SwitchToEnglish />
    </LocaleProvider>,
  );
  return screen.getByRole("textbox");
}

const advance = () => act(() => vi.advanceTimersByTime(ROTATION_INTERVAL_MS));
const hint = (input: HTMLElement) => input.getAttribute("placeholder");

describe("CommandInput", () => {
  it.each([
    ["cs", "Příkaz pro mapu"],
    ["en", "Map command"],
  ] as const)("AC-10: has the accessible name in %s", (locale, name) => {
    renderInput(locale);

    expect(screen.getByRole("textbox", { name })).toBeDefined();
  });

  it("FR-3: the focus transition is disabled for reduced motion", () => {
    const input = renderInput("cs");

    expect(input.className).toContain("motion-reduce:transition-none");
  });

  it.each([
    ["cs", ["Přibliž na Prahu", "Zobraz cyklostezky", "Ukaž Brno"]],
    ["en", ["Zoom to Prague", "Show cycling routes", "Show Brno"]],
  ] as const)(
    "AC-3: rotates the %s hints in order and loops",
    (locale, hints) => {
      const input = renderInput(locale);

      const seen = [hint(input)];
      for (let i = 0; i < 3; i++) {
        advance();
        seen.push(hint(input));
      }

      expect(seen).toEqual([...hints, hints[0]]);
    },
  );

  it("AC-4: rotation pauses while typing and resumes when emptied", () => {
    const input = renderInput("en");
    fireEvent.change(input, { target: { value: "Pra" } });
    advance();
    advance();
    fireEvent.change(input, { target: { value: "" } });

    expect(hint(input)).toBe("Zoom to Prague");
    advance();
    expect(hint(input)).toBe("Show cycling routes");
  });

  it("AC-2: Enter does nothing and the text stays", () => {
    const input = renderInput("en");
    fireEvent.change(input, { target: { value: "Zoom to Brno" } });

    const notPrevented = fireEvent.keyDown(input, { key: "Enter" });

    expect(notPrevented).toBe(true);
    expect((input as HTMLInputElement).value).toBe("Zoom to Brno");
  });

  it("AC-7, AC-8: a language switch keeps the text and the hint position in the new language", () => {
    const input = renderInput("cs");
    advance();
    expect(hint(input)).toBe("Zobraz cyklostezky");

    fireEvent.change(input, { target: { value: "abc" } });
    act(() => screen.getByRole("button", { name: "switch" }).click());
    expect((input as HTMLInputElement).value).toBe("abc");
    expect(screen.getByRole("textbox", { name: "Map command" })).toBe(input);

    fireEvent.change(input, { target: { value: "" } });
    expect(hint(input)).toBe("Show cycling routes");
  });
});
