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
import type { MapTarget } from "@/map";
import type { CommandResponse } from "@/shared/command/commandContract";
import { CommandInput } from "./CommandInput";
import type { CommandClient } from "./commandClient";
import { NOTICE_DURATION_MS } from "./notice";
import { ROTATION_INTERVAL_MS } from "./placeholderConstants";

// The component imports the real client; tests replace it (the component takes no function
// prop for it, which a "use client" entry file must avoid).
const sendCommandMock = vi.hoisted(() => vi.fn<CommandClient>());
vi.mock("./commandClient", () => ({ sendCommand: sendCommandMock }));

const BRNO: MapTarget = {
  bounds: [
    [16.4, 49.1],
    [16.7, 49.3],
  ],
};

const success = (cooldownSeconds = 10): CommandResponse => ({
  ok: true,
  result: { action: "zoom_to_place", bounds: BRNO.bounds },
  cooldownSeconds,
});

const failure = (
  code: Extract<CommandResponse, { ok: false }>["error"]["code"],
  details: {
    retryAfterSeconds?: number;
    resetAt?: string;
    cooldownSeconds?: number;
  } = {},
): CommandResponse => ({ ok: false, error: { code, ...details } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("cookieStore", { set: () => Promise.resolve() });
  window.history.replaceState(null, "", "/cs");
  window.localStorage.clear();
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

function setup(
  locale: Locale = "cs",
  {
    response = success(),
    onMove = vi.fn(),
    onSend = vi.fn(),
  }: {
    response?: CommandResponse;
    onMove?: ((target: MapTarget) => void) | null;
    onSend?: () => void;
  } = {},
) {
  const client = sendCommandMock;
  client.mockReset();
  client.mockImplementation(async () => response);
  const ui = (
    <LocaleProvider initialLocale={locale}>
      <CommandInput onMoveAction={onMove} onSendAction={onSend} />
      <SwitchToEnglish />
    </LocaleProvider>
  );
  const view = render(ui);
  const input = screen.getByRole("textbox");
  return { client, onMove, onSend, input, ui, ...view };
}

const type = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

async function submit(input: HTMLElement) {
  const form = input.closest("form");
  if (!form) throw new Error("no form");
  await act(async () => {
    fireEvent.submit(form);
  });
}

const advance = (milliseconds: number) =>
  act(() => vi.advanceTimersByTime(milliseconds));
const hint = (input: HTMLElement) => input.getAttribute("placeholder");
const status = () => screen.getByRole("status").textContent;
const typed = (input: HTMLElement) => (input as HTMLInputElement).value;

describe("hints and basics", () => {
  it.each([
    ["cs", "Příkaz pro mapu"],
    ["en", "Map command"],
  ] as const)("has the accessible name in %s", (locale, name) => {
    setup(locale);

    expect(screen.getByRole("textbox", { name })).toBeDefined();
  });

  it.each([
    [
      "cs",
      [
        "Přibliž na Prahu",
        "Zobraz Vysoké Tatry",
        "Ukaž 1st Avenue v New Yorku",
        "Francie",
        "Moskva",
        "Přibliž na Tokio",
        "Ukaž Grand Canyon",
        "Mount Everest",
        "Přibliž na Koloseum",
      ],
    ],
    [
      "en",
      [
        "Zoom to Prague",
        "Show the High Tatras",
        "Show 1st Avenue in New York",
        "France",
        "Moscow",
        "Zoom to Tokyo",
        "Show the Grand Canyon",
        "Mount Everest",
        "Zoom to the Colosseum",
      ],
    ],
  ] as const)(
    "AC-25: rotates the %s hints, none of them is about cycling routes",
    (locale, hints) => {
      const { input } = setup(locale);

      const seen = [hint(input)];
      for (let i = 0; i < hints.length; i++) {
        advance(ROTATION_INTERVAL_MS);
        seen.push(hint(input));
      }

      expect(seen).toEqual([...hints, hints[0]]);
    },
  );

  it("rotation pauses while typing and resumes when emptied", () => {
    const { input } = setup("en");
    type(input, "Pra");
    advance(ROTATION_INTERVAL_MS * 2);
    type(input, "");

    expect(hint(input)).toBe("Zoom to Prague");
    advance(ROTATION_INTERVAL_MS);
    expect(hint(input)).toBe("Show the High Tatras");
  });

  it("a language switch keeps the text and the hint position in the new language", () => {
    const { input } = setup("cs");
    advance(ROTATION_INTERVAL_MS);
    expect(hint(input)).toBe("Zobraz Vysoké Tatry");

    type(input, "abc");
    act(() => screen.getByRole("button", { name: "switch" }).click());
    expect(typed(input)).toBe("abc");

    type(input, "");
    expect(hint(input)).toBe("Show the High Tatras");
  });

  it("AC-4: stops accepting more than 200 characters", () => {
    const { input } = setup();

    expect(input.getAttribute("maxlength")).toBe("200");
  });
});

describe("submitting", () => {
  it.each(["", "   ", " \t\n "])(
    "AC-2: %j sends no request and shows nothing",
    async (value) => {
      const { input, client } = setup();
      type(input, value);

      await submit(input);

      expect(client).not.toHaveBeenCalled();
      expect(status()).toBe("");
    },
  );

  it("AC-1: sends the cleaned text with the UI language and moves the map", async () => {
    const { input, client, onMove } = setup("en");
    type(input, "  Zoom \n to   Brno​ ");

    await submit(input);

    expect(client).toHaveBeenCalledExactlyOnceWith({
      text: "Zoom to Brno",
      locale: "en",
    });
    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ bounds: BRNO.bounds }),
    );
  });

  it("AC-3: shows and announces loading, ignores a second Enter and stays editable", async () => {
    let answer: (response: CommandResponse) => void = () => {};
    const { input, client } = setup("cs");
    client.mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    type(input, "Přibliž na Brno");

    await submit(input);
    await submit(input);

    expect(client).toHaveBeenCalledOnce();
    expect(status()).toBe("Zpracovávám příkaz…");
    expect(input.getAttribute("aria-busy")).toBe("true");
    expect((input as HTMLInputElement).disabled).toBe(false);
    type(input, "Přibliž na Plzeň");
    expect(typed(input)).toBe("Přibliž na Plzeň");
    expect(status()).toBe("Zpracovávám příkaz…");

    await act(async () => answer(failure("error")));
    expect(input.getAttribute("aria-busy")).toBe("false");
  });

  it("AC-7: tells the map a command is sent before the answer arrives", async () => {
    let answer: (response: CommandResponse) => void = () => {};
    const { input, client, onSend, onMove } = setup("cs");
    client.mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    type(input, "Přibliž na Brno");

    await submit(input);

    expect(onSend).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
    await act(async () => answer(success()));
  });

  it.each([
    ["a failure", failure("not_found")],
    ["a cooldown message", failure("wait", { retryAfterSeconds: 5 })],
  ])(
    "AC-8: %s is still preceded by the highlight removal",
    async (_name, response) => {
      const { input, onSend } = setup("cs", { response });
      type(input, "Přibliž na Brno");

      await submit(input);

      expect(onSend).toHaveBeenCalledOnce();
    },
  );

  it("AC-23: without a ready map shows the generic error and sends nothing", async () => {
    const { input, client } = setup("en", { onMove: null });
    type(input, "Zoom to Brno");

    await submit(input);

    expect(client).not.toHaveBeenCalled();
    expect(status()).toBe(
      "The command could not be processed. Please try again later.",
    );
  });
});

describe("cooldown after a success", () => {
  async function succeed(locale: Locale = "cs", cooldownSeconds = 10) {
    const view = setup(locale, { response: success(cooldownSeconds) });
    view.input.focus();
    type(view.input, "Zoom to Brno");
    await submit(view.input);
    return view;
  }

  it.each(["cs", "en"] as const)(
    "AC-11: disables the input at once, shows the countdown in the field (%s) and empties the text",
    async (locale) => {
      const { input } = await succeed(locale);

      expect((input as HTMLInputElement).disabled).toBe(true);
      expect(screen.getByText("10 s")).toBeDefined();
      expect(typed(input)).toBe("");
    },
  );

  it("AC-11: counts down every second", async () => {
    await succeed("en");

    advance(1000);
    expect(screen.getByText("9 s")).toBeDefined();
    advance(7000);
    expect(screen.getByText("2 s")).toBeDefined();
    advance(1000);
    expect(screen.getByText("1 s")).toBeDefined();
  });

  it("NFR-3: announces the pause at its start and the end, not every second", async () => {
    await succeed("en");
    expect(status()).toBe("The map has moved. Input is paused for 10 seconds.");

    advance(3000);
    expect(status()).toBe("The map has moved. Input is paused for 10 seconds.");
    advance(NOTICE_DURATION_MS - 3000);
    expect(status()).toBe("");

    advance(2000);
    expect(status()).toBe("You can enter the next command.");
  });

  it("AC-11: enables the input after 10 s and re-focuses it when it had focus", async () => {
    const { input } = await succeed("cs");

    advance(10_000);

    expect((input as HTMLInputElement).disabled).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(screen.queryByText(/^d+ s$/)).toBeNull();
    expect(typed(input)).toBe("");
  });

  it("AC-11: does not take the focus when the input had none", async () => {
    const view = setup("cs");
    type(view.input, "Zoom to Brno");
    await submit(view.input);

    advance(10_000);

    expect(document.activeElement).not.toBe(view.input);
  });

  it("does not submit while paused", async () => {
    const { input, client } = await succeed("cs");

    await submit(input);

    expect(client).toHaveBeenCalledOnce();
  });

  it("AC-12: after a reload the cooldown restores to the remaining time", async () => {
    const first = await succeed("cs");
    advance(4000);
    first.unmount();

    const { input } = setup("cs");

    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("6 s")).toBeDefined();
    advance(6000);
    expect((input as HTMLInputElement).disabled).toBe(false);
  });

  it("AC-12: an expired cooldown is not restored", async () => {
    const first = await succeed("cs");
    first.unmount();
    advance(11_000);

    const { input } = setup("cs");

    expect((input as HTMLInputElement).disabled).toBe(false);
  });

  it("AC-12: a server wait enters the same paused state with the remaining seconds", async () => {
    const { input, onMove } = setup("en", {
      response: failure("wait", { retryAfterSeconds: 4 }),
    });
    type(input, "Zoom to Brno");

    await submit(input);

    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("4 s")).toBeDefined();
    expect(onMove).not.toHaveBeenCalled();
  });

  it("AC-21: a language switch keeps the pause and the countdown", async () => {
    const { input } = await succeed("cs");
    advance(2000);

    act(() => screen.getByRole("button", { name: "switch" }).click());

    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("8 s")).toBeDefined();
  });
});

describe("cooldown after a failure", () => {
  it("pauses the input, keeps the typed text and keeps the failure message visible", async () => {
    const { input } = setup("cs", {
      response: failure("unsupported", { cooldownSeconds: 10 }),
    });
    type(input, "Show cycling routes");

    await submit(input);

    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("10 s")).toBeDefined();
    expect(status()).toMatch(/^Podporuji jen přiblížení/);
    expect(typed(input)).toBe("Show cycling routes");

    advance(10_000);
    expect((input as HTMLInputElement).disabled).toBe(false);
  });
});

describe("failures", () => {
  it.each([
    [
      "unsupported",
      "cs",
      /^Podporuji jen přiblížení na místo na mapě, například/,
    ],
    ["unsupported", "en", /^Only zooming to a place on the map is supported/],
    ["not_found", "cs", /^Toto místo se nepodařilo najít/],
    ["not_found", "en", /^This place could not be found/],
    ["error", "cs", /^Příkaz se nepodařilo zpracovat/],
    ["error", "en", /^The command could not be processed/],
    ["invalid_request", "en", /^This command cannot be sent/],
    ["ai_resting", "cs", /^Umělá inteligence teď odpočívá\. Zkuste to později/],
    [
      "ai_resting",
      "en",
      /^The AI is resting right now\. Please try again later/,
    ],
  ] as const)(
    "AC-15, AC-16, AC-17, AC-18: %s in %s shows its message, leaves the map and starts no cooldown",
    async (code, locale, message) => {
      const { input, onMove, client } = setup(locale, {
        response: failure(code),
      });
      type(input, "Zoom to Vienna");

      await submit(input);

      expect(status()).toMatch(message);
      expect(onMove).not.toHaveBeenCalled();
      expect((input as HTMLInputElement).disabled).toBe(false);
      await submit(input);
      expect(client).toHaveBeenCalledTimes(2);
    },
  );

  it("shows when the AI is resting until, in the language of the page", async () => {
    const { input } = setup("cs", {
      response: failure("ai_resting", { resetAt: "2026-11-10T00:00:00.000Z" }),
    });
    type(input, "Zoom to Brno");

    await submit(input);

    expect(status()).toMatch(
      /^Umělá inteligence teď odpočívá\. Zkuste to znovu po \d/,
    );
  });

  it.each([
    ["cs", 1, "za 1 sekundu"],
    ["cs", 3, "za 3 sekundy"],
    ["cs", 60, "za 60 sekund"],
    ["en", 1, "in 1 second."],
    ["en", 45, "in 45 seconds."],
  ] as const)(
    "AC-13: too many requests in %s with %i s",
    async (locale, seconds, text) => {
      const { input } = setup(locale, {
        response: failure("too_many_requests", { retryAfterSeconds: seconds }),
      });
      type(input, "Zoom to Brno");

      await submit(input);

      expect(status()).toContain(text);
    },
  );

  it("AC-20: a failure disappears when the text is edited", async () => {
    const { input } = setup("cs", { response: failure("not_found") });
    type(input, "Zoom to Vienna");
    await submit(input);
    expect(status()).not.toBe("");

    type(input, "Zoom to Vienn");

    expect(status()).toBe("");
  });

  it("AC-20: a failure disappears after 8 s", async () => {
    const { input } = setup("cs", { response: failure("error") });
    type(input, "Zoom to Brno");
    await submit(input);

    advance(NOTICE_DURATION_MS - 1);
    expect(status()).not.toBe("");
    advance(1);

    expect(status()).toBe("");
  });

  it("AC-20: shows one message at a time", async () => {
    const { input, client } = setup("cs");
    client
      .mockResolvedValueOnce(failure("unsupported"))
      .mockResolvedValueOnce(failure("not_found"));
    type(input, "Zoom to Brno");

    await submit(input);
    await submit(input);

    expect(screen.getByRole("status").children).toHaveLength(1);
    expect(status()).toMatch(/nepodařilo najít/);
  });

  it("AC-21: switching the language re-renders the shown message without a new request", async () => {
    const { input, client } = setup("cs", { response: failure("not_found") });
    type(input, "Zoom to Vienna");
    await submit(input);

    act(() => screen.getByRole("button", { name: "switch" }).click());

    expect(status()).toBe("This place could not be found.");
    expect(client).toHaveBeenCalledOnce();
  });

  it("AC-27: the input keeps working after a failure", async () => {
    const { input, client, onMove } = setup("cs");
    client.mockResolvedValueOnce(failure("error"));
    type(input, "Zoom to Brno");
    await submit(input);

    await submit(input);

    expect(onMove).toHaveBeenCalledOnce();
  });
});
