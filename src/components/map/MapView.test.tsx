import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/routing";
import type { CreateMapEngine, MapEngine, MapEngineOptions } from "@/map";
import type { Bounds } from "@/shared/actions";
import { FakeStorage } from "@/test/fakeStorage";
import { makeSnapshot } from "@/test/metricsSnapshot";
import { stubMatchMedia } from "@/test/stubMatchMedia";
import { acknowledgedTermsStore, termsStore } from "@/test/termsStore";
import { HistoryStoreProvider } from "../history/store/HistoryStoreProvider";
import { createSessionHistoryStorage } from "../history/store/historyStorage";
import { createHistoryStore } from "../history/store/historyStore";
import { TermsAcknowledgementProvider } from "../terms/store/TermsAcknowledgementProvider";
import type { TermsAcknowledgementStore } from "../terms/store/termsAcknowledgementStore";
import { TERMS_VERSION } from "../terms/termsConstants";
import { MapView } from "./MapView";

beforeEach(() => {
  vi.stubGlobal("cookieStore", { set: () => Promise.resolve() });
  window.localStorage.clear();
  window.history.replaceState(null, "", "/cs");
  stubMatchMedia();
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

function historyStore(storage = new FakeStorage()) {
  return createHistoryStore({
    storage: createSessionHistoryStorage(() => storage),
    now: Date.now,
    newId: () => crypto.randomUUID(),
  });
}

function renderMap(
  locale: Locale,
  createEngine: CreateMapEngine,
  storage = new FakeStorage(),
  terms: TermsAcknowledgementStore = acknowledgedTermsStore(),
) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <TermsAcknowledgementProvider store={terms}>
        <HistoryStoreProvider store={historyStore(storage)}>
          <MapView createEngine={createEngine} />
        </HistoryStoreProvider>
      </TermsAcknowledgementProvider>
    </LocaleProvider>,
  );
}

function setup(
  locale: Locale = "cs",
  storage = new FakeStorage(),
  terms?: TermsAcknowledgementStore,
) {
  const destroy = vi.fn();
  const moveTo = vi.fn<MapEngine["moveTo"]>();
  const clearHighlight = vi.fn<MapEngine["clearHighlight"]>();
  const calls: MapEngineOptions[] = [];
  const createEngine = vi.fn<CreateMapEngine>((options) => {
    calls.push(options);
    return { controlsSlot: fakeSlot(), moveTo, clearHighlight, destroy };
  });
  return {
    ...renderMap(locale, createEngine, storage, terms),
    calls,
    destroy,
    createEngine,
    moveTo,
    clearHighlight,
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
      clearHighlight: vi.fn(),
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
        clearHighlight: vi.fn(),
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
      stubMatchMedia({ reducedMotion });
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

    it("AC-1: the highlight of the answer is passed to the map with the target", async () => {
      const highlight = { type: "Point", coordinates: [16.6, 49.2] };
      const { moveTo } = setup("en");
      vi.stubGlobal("fetch", async () =>
        Response.json({
          ok: true,
          result: { action: "zoom_to_place", bounds: BOUNDS, highlight },
          cooldownSeconds: 10,
        }),
      );
      stubMatchMedia();

      await zoomToBrno();

      expect(moveTo).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ highlight }),
        "animate",
      );
    });

    it("AC-7: sending a command removes the highlight before the map moves", async () => {
      const { moveTo, clearHighlight } = setup("en");
      stubEnvironment(false);
      const order: string[] = [];
      clearHighlight.mockImplementation(() => order.push("clear"));
      moveTo.mockImplementation(() => order.push("move"));

      await zoomToBrno();

      expect(order).toEqual(["clear", "move"]);
    });

    it("AC-26: with reduced motion the map jumps", async () => {
      const { moveTo } = setup("en");
      stubEnvironment(true);

      await zoomToBrno();

      expect(moveTo).toHaveBeenCalledExactlyOnceWith(expect.anything(), "jump");
    });
  });

  describe("map status in the Metrics tab (spec 010)", () => {
    async function openMetrics() {
      fireEvent.click(screen.getByRole("button", { name: "Open side panel" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("tab", { name: "Metrics" }));
      await within(dialog).findByRole("heading", { name: "Application" });
    }

    const mapLight = () => {
      const row = screen
        .getAllByRole("listitem")
        .find((item) => item.textContent === "Map");
      if (!row) throw new Error("no map light");
      return within(row).getByRole("img").getAttribute("title");
    };

    it("AC-9: the light follows the engine's tile state without any request for it", async () => {
      const fetchMock = vi.fn(async () =>
        Response.json({ ok: true, metrics: makeSnapshot() }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const { calls } = setup("en");
      await openMetrics();
      expect(mapLight()).toBe("Status not known yet");
      const fetches = fetchMock.mock.calls.length;

      act(() => calls[0]?.onAvailabilityChange("unavailable"));
      expect(mapLight()).toBe("Service is not available");
      act(() => calls[0]?.onAvailabilityChange("available"));
      expect(mapLight()).toBe("Service is available");

      expect(fetchMock).toHaveBeenCalledTimes(fetches);
    });

    it("a new engine starts unknown again", async () => {
      vi.stubGlobal("fetch", async () =>
        Response.json({ ok: true, metrics: makeSnapshot() }),
      );
      const { calls, createEngine, rerender } = setup("en");
      act(() => calls[0]?.onAvailabilityChange("available"));
      await openMetrics();
      expect(mapLight()).toBe("Service is available");

      const replacement = vi.fn<CreateMapEngine>((options) =>
        createEngine(options),
      );
      rerender(
        <LocaleProvider initialLocale="en">
          <TermsAcknowledgementProvider store={acknowledgedTermsStore()}>
            <HistoryStoreProvider store={historyStore()}>
              <MapView createEngine={replacement} />
            </HistoryStoreProvider>
          </TermsAcknowledgementProvider>
        </LocaleProvider>,
      );

      await waitFor(() => expect(replacement).toHaveBeenCalledOnce());
      expect(mapLight()).toBe("Status not known yet");
    });
  });

  describe("start-up notice (spec 012)", () => {
    const noticeName = { cs: "Vítejte v GeoGrind", en: "Welcome to GeoGrind" };

    function setupNotice(
      locale: Locale = "en",
      storage: Storage = new FakeStorage(),
    ) {
      const terms = termsStore(storage);
      return { ...setup(locale, new FakeStorage(), terms), terms, storage };
    }

    const notice = () => screen.queryByRole("dialog");
    const findNotice = (locale: Locale = "en") =>
      screen.findByRole("dialog", { name: noticeName[locale] });

    it.each([
      ["cs", "Rozumím"],
      ["en", "I understand"],
    ] as const)(
      "AC-1: on a first visit the notice opens in %s and the page behind is not operable",
      async (locale, confirm) => {
        setupNotice(locale);

        const dialog = await findNotice(locale);

        expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
        expect(
          within(dialog).getByRole("button", { name: confirm }),
        ).toBeDefined();
        await waitFor(() =>
          expect(
            screen
              .getByRole("region", { hidden: true })
              .closest("[aria-hidden='true'], [inert]"),
          ).not.toBeNull(),
        );
      },
    );

    it("AC-1, AC-16: the notice has a name, its three points as the description and focus inside", async () => {
      setupNotice("en");
      const dialog = await findNotice();

      const describedBy = dialog.getAttribute("aria-describedby") ?? "";
      const description = document.getElementById(describedBy);
      expect(description?.tagName).toBe("UL");
      expect(description?.textContent).toContain("sensitive or personal data");
      expect(description?.textContent).toContain("AI sometimes gets it wrong");
      expect(description?.textContent).toContain("pseudonym");
      await waitFor(() =>
        expect(dialog.contains(document.activeElement)).toBe(true),
      );
    });

    it("the notice shows no draft or legal-advice remark", async () => {
      setupNotice("en");
      const dialog = await findNotice();

      expect(dialog.textContent).not.toMatch(/draft|legal advice/i);
    });

    it("AC-2, AC-16: “I understand” closes the notice, stores the version and moves focus to the command input", async () => {
      const storage = new FakeStorage();
      const first = setupNotice("en", storage);
      const dialog = await findNotice();

      fireEvent.click(
        within(dialog).getByRole("button", { name: "I understand" }),
      );

      await waitFor(() => expect(notice()).toBeNull());
      expect(storage.items.get("geogrind.termsAcknowledgement")).toContain(
        TERMS_VERSION,
      );
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole("textbox", { name: "Map command" }),
        ),
      );

      first.unmount();
      setupNotice("en", storage);
      await act(async () => {});
      expect(notice()).toBeNull();
    });

    it("AC-3: Escape closes the notice and stores the acknowledgement", async () => {
      const { terms } = setupNotice("en");
      await findNotice();

      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });

      await waitFor(() => expect(notice()).toBeNull());
      expect(terms.getState().acknowledgedVersion).toBe(TERMS_VERSION);
    });

    it("AC-4: a click outside the notice leaves it open", async () => {
      const { terms } = setupNotice("en");
      await findNotice();
      const outside = [
        ...document.querySelectorAll("[role='presentation']"),
        screen.getByRole("region", { hidden: true }),
      ];
      expect(outside.length).toBeGreaterThan(1);

      for (const element of outside) {
        fireEvent.pointerDown(element);
        fireEvent.mouseDown(element);
        fireEvent.pointerUp(element);
        fireEvent.click(element);
      }
      await act(async () => {});

      expect(notice()).not.toBeNull();
      expect(terms.getState().acknowledgedVersion).toBeNull();
    });

    it.each([
      [false, "full screen below 768 px"],
      [true, "beside the map from 768 px"],
    ])(
      "AC-5: the link closes the notice, stores it and opens the panel on the Terms tab (large: %s, %s)",
      async (large) => {
        stubMatchMedia({ large });
        const { terms } = setupNotice("en");
        const dialog = await findNotice();

        fireEvent.click(
          within(dialog).getByRole("button", { name: "Terms and privacy" }),
        );

        const panel = await screen.findByRole("dialog", { name: "Side panel" });
        expect(notice()?.getAttribute("aria-label")).toBe("Side panel");
        expect(terms.getState().acknowledgedVersion).toBe(TERMS_VERSION);
        expect(
          within(panel).getByRole("tab", { name: "Terms", selected: true }),
        ).toBeDefined();
        expect(
          within(panel).getByRole("heading", {
            name: "Terms of use and privacy notice",
          }),
        ).toBeDefined();
        expect(
          screen.getByRole("region", { name: "Map", hidden: true }).className,
        ).toContain("md:w-[calc(100dvw-19rem)]");
        await waitFor(() =>
          expect(panel.contains(document.activeElement)).toBe(true),
        );
      },
    );

    it("AC-6: switching the language in the notice changes all its texts, keeps focus and both switches agree", async () => {
      setupNotice("cs");
      const dialog = await findNotice("cs");
      const english = within(dialog).getByRole("radio", { name: "Angličtina" });
      english.focus();

      act(() => english.click());

      expect(dialog.getAttribute("aria-labelledby")).not.toBeNull();
      expect(
        within(dialog).getByRole("heading", { name: noticeName.en }),
      ).toBeDefined();
      expect(
        within(dialog).getByRole("button", { name: "I understand" }),
      ).toBeDefined();
      expect(
        within(dialog).getByRole("button", { name: "Terms and privacy" }),
      ).toBeDefined();
      expect(dialog.textContent).not.toMatch(/Rozumím|citlivé/);
      expect(document.activeElement).toBe(
        within(dialog).getByRole("radio", { name: "English" }),
      );
      const mapSwitch = screen
        .getAllByRole("radiogroup", { hidden: true })
        .find((group) => !dialog.contains(group));
      expect(
        within(mapSwitch ?? document.body)
          .getByRole("radio", { name: "English", hidden: true })
          .getAttribute("aria-checked"),
      ).toBe("true");
      expect(window.location.pathname).toBe("/en");
    });

    it.each([
      [true, false],
      [false, true],
    ])(
      "AC-10: acknowledged %s, the notice is ever rendered: %s",
      async (acknowledged, everRendered) => {
        const storage = new FakeStorage();
        if (acknowledged) termsStore(storage).getState().acknowledge();
        const added: Node[] = [];
        const collect = (records: MutationRecord[]) => {
          for (const record of records) added.push(...record.addedNodes);
        };
        const observer = new MutationObserver(collect);
        observer.observe(document.body, { childList: true, subtree: true });

        setupNotice("en", storage);
        await act(async () => {});
        collect(observer.takeRecords());
        observer.disconnect();

        const dialogAdded = added.some(
          (node) =>
            node instanceof Element &&
            (node.matches("[role='dialog']") ||
              node.querySelector("[role='dialog']") !== null),
        );
        expect(dialogAdded).toBe(everRendered);
      },
    );

    it("AC-14: when the map fails, only the failure message is shown and no notice", async () => {
      const { calls } = setupNotice("en");
      await findNotice();

      act(() => calls[0]?.onFailure("style"));

      await waitFor(() => expect(notice()).toBeNull());
      expect(screen.getByRole("alert")).toBeDefined();
    });

    it("AC-15: the acknowledgement makes no request and commands work as before", async () => {
      const fetchMock = vi.fn(async () =>
        Response.json({
          ok: true,
          result: {
            action: "zoom_to_place",
            bounds: [
              [16.4, 49.1],
              [16.7, 49.3],
            ],
          },
          cooldownSeconds: 0,
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const { moveTo } = setupNotice("en");
      const dialog = await findNotice();

      fireEvent.click(
        within(dialog).getByRole("button", { name: "I understand" }),
      );
      await waitFor(() => expect(notice()).toBeNull());
      expect(fetchMock).not.toHaveBeenCalled();

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Zoom to Brno" } });
      await act(async () => {
        fireEvent.submit(input.closest("form") ?? input);
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(moveTo).toHaveBeenCalledOnce();
    });
  });

  describe("side panel and history", () => {
    const BOUNDS: Bounds = [
      [16.4, 49.1],
      [16.7, 49.3],
    ];
    const HIGHLIGHT = { type: "Point", coordinates: [16.6, 49.2] };

    const answer = (body: unknown) => vi.fn(async () => Response.json(body));
    const success = {
      ok: true,
      result: { action: "zoom_to_place", bounds: BOUNDS, highlight: HIGHLIGHT },
      cooldownSeconds: 0,
    };

    async function command(text: string) {
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: text } });
      const form = input.closest("form");
      if (!form) throw new Error("no form");
      await act(async () => {
        fireEvent.submit(form);
      });
    }

    async function openPanel() {
      fireEvent.click(screen.getByRole("button", { name: "Open side panel" }));
      return await screen.findByRole("dialog");
    }

    it("AC-3, AC-9: a successful command is added, a second one for the same place too", async () => {
      vi.stubGlobal("fetch", answer(success));
      setup("en");

      await command("Zoom to Brno");
      await command("Zoom to Brno");

      const dialog = await openPanel();
      expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
    });

    it("AC-4: a failed command adds nothing", async () => {
      vi.stubGlobal(
        "fetch",
        answer({
          ok: false,
          error: { code: "not_found", cooldownSeconds: 10 },
        }),
      );
      setup("en");

      await command("Zoom to Atlantis");

      const dialog = await openPanel();
      expect(within(dialog).queryByRole("list")).toBeNull();
    });

    it("AC-5: the entries are kept in session storage and restored after a reload", async () => {
      vi.stubGlobal("fetch", answer(success));
      const storage = new FakeStorage();
      const first = setup("en", storage);
      await command("Zoom to Brno");
      first.unmount();

      setup("en", storage);

      const dialog = await openPanel();
      expect(within(dialog).getByText("Zoom to Brno")).toBeDefined();
    });

    it("AC-6, AC-7: a re-run moves the map with the stored result without any request or input change", async () => {
      stubMatchMedia({ large: true });
      const fetchMock = answer(success);
      vi.stubGlobal("fetch", fetchMock);
      const { moveTo } = setup("en");
      await command("Zoom to Brno");
      moveTo.mockClear();
      fetchMock.mockClear();
      const dialog = await openPanel();
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "draft" },
      });

      fireEvent.click(
        within(dialog).getByRole("button", { name: /Zoom to Brno/ }),
      );

      expect(moveTo).toHaveBeenCalledExactlyOnceWith(
        { action: "zoom_to_place", bounds: BOUNDS, highlight: HIGHLIGHT },
        "animate",
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
        "draft",
      );
    });

    it("AC-7: a re-run works while the input is in a cooldown and leaves it unchanged", async () => {
      stubMatchMedia({ large: true });
      vi.stubGlobal("fetch", answer({ ...success, cooldownSeconds: 10 }));
      const { moveTo } = setup("en");
      await command("Zoom to Brno");
      moveTo.mockClear();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.disabled).toBe(true);

      const dialog = await openPanel();
      fireEvent.click(
        within(dialog).getByRole("button", { name: /Zoom to Brno/ }),
      );

      expect(moveTo).toHaveBeenCalledOnce();
      expect(input.disabled).toBe(true);
    });

    it("AC-8: entries are disabled while a command request is running", async () => {
      stubMatchMedia({ large: true });
      const storage = new FakeStorage();
      createSessionHistoryStorage(() => storage).save([
        {
          id: "stored",
          at: Date.now(),
          text: "Zoom to Brno",
          result: { action: "zoom_to_place", bounds: BOUNDS },
        },
      ]);
      setup("en", storage);
      const dialog = await openPanel();
      const entry = within(dialog).getByRole("button", {
        name: /Zoom to Brno/,
      });
      expect((entry as HTMLButtonElement).disabled).toBe(false);

      let finish: (response: Response) => void = () => {};
      vi.stubGlobal(
        "fetch",
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      );
      await command("Zoom to Plzen");
      expect((entry as HTMLButtonElement).disabled).toBe(true);

      await act(async () => {
        finish(Response.json({ ok: false, error: { code: "unsupported" } }));
      });
      expect((entry as HTMLButtonElement).disabled).toBe(false);
    });

    it("AC-13: no panel control when the map failed to load", () => {
      const { calls } = setup("en");

      act(() => calls[0]?.onFailure("style"));

      expect(
        screen.queryByRole("button", { name: "Open side panel" }),
      ).toBeNull();
    });

    it("AC-18: an open panel narrows the map from 768 px and the map is full width again after closing", async () => {
      setup("en");
      const section = screen.getByRole("region", { name: "Map" });
      expect(section.className).not.toContain("md:w-");

      const dialog = await openPanel();
      expect(section.className).toContain("md:w-[calc(100dvw-19rem)]");

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Close side panel" }),
      );
      await waitFor(() => expect(section.className).not.toContain("md:w-"));
    });
  });
});
