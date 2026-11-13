import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/routing";
import { FakeStorage, makeEntry } from "@/test/fakeStorage";
import { stubMatchMedia } from "@/test/stubMatchMedia";
import { HistoryStoreProvider } from "../history/HistoryStoreProvider";
import type { HistoryEntry } from "../history/historyEntrySchema";
import { createSessionHistoryStorage } from "../history/historyStorage";
import { createHistoryStore } from "../history/historyStore";
import { SidePanel, type SidePanelProps } from "./SidePanel";

beforeEach(() => {
  vi.stubGlobal("cookieStore", { set: () => Promise.resolve() });
  window.history.replaceState(null, "", "/cs");
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function Harness({
  controlSlot,
  showResult,
}: Pick<SidePanelProps, "controlSlot" | "showResult">) {
  const [open, setOpen] = useState(false);
  return (
    <SidePanel
      open={open}
      onOpenChange={setOpen}
      controlSlot={controlSlot}
      showResult={showResult}
    />
  );
}

function setup({
  locale = "en",
  large = false,
  entries = [],
  withSlot = true,
  showResult = vi.fn(),
}: {
  locale?: Locale;
  large?: boolean;
  entries?: HistoryEntry[];
  withSlot?: boolean;
  showResult?: SidePanelProps["showResult"];
} = {}) {
  const media = stubMatchMedia({ large });
  const storage = new FakeStorage();
  createSessionHistoryStorage(() => storage).save(entries);
  const store = createHistoryStore({
    storage: createSessionHistoryStorage(() => storage),
    now: Date.now,
    newId: () => "new",
  });
  const slot = document.createElement("div");
  const outside = document.createElement("button");
  outside.textContent = "map";
  document.body.append(slot, outside);
  render(
    <LocaleProvider initialLocale={locale}>
      <HistoryStoreProvider store={store}>
        <Harness controlSlot={withSlot ? slot : null} showResult={showResult} />
      </HistoryStoreProvider>
    </LocaleProvider>,
  );
  return { media, store, slot, outside, showResult };
}

const openControl = () =>
  screen.getByRole("button", {
    name: /^(Open side panel|Otevřít boční panel)$/,
  });
const panel = () => screen.queryByRole("dialog");
const open = async () => {
  fireEvent.click(openControl());
  return await screen.findByRole("dialog");
};

describe("opening and closing", () => {
  it("AC-1: the control opens a panel with a History tab, the close control closes it", async () => {
    setup();

    const dialog = await open();

    expect(dialog.getAttribute("aria-label")).toBe("Side panel");
    expect(
      within(dialog).getByRole("tab", { name: "History", selected: true }),
    ).toBeDefined();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close side panel" }),
    );
    await waitFor(() => expect(panel()).toBeNull());
  });

  it("AC-1: Escape closes the panel", async () => {
    setup();
    await open();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(panel()).toBeNull());
  });

  it("FR-1, AC-1: Escape closes the large-screen panel while focus is elsewhere", async () => {
    const { outside } = setup({ large: true });
    await open();
    outside.focus();

    fireEvent.keyDown(outside, { key: "Escape" });

    await waitFor(() => expect(panel()).toBeNull());
  });

  it("NFR-3: focus moves into the panel and returns to the control on close", async () => {
    setup();
    const control = openControl();
    control.focus();

    const dialog = await open();
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close side panel" }),
    );

    await waitFor(() => expect(panel()).toBeNull());
    expect(document.activeElement).toBe(control);
  });

  it("AC-13: without a control slot (map not ready) no control is shown", () => {
    setup({ withSlot: false });

    expect(screen.queryByRole("button", { name: /side panel/i })).toBeNull();
  });

  it("the control is rendered into the given slot", () => {
    const { slot } = setup();

    expect(slot.contains(openControl())).toBe(true);
  });

  it("AC-17: tabs come from the tab list, with an accessible tab list name", async () => {
    setup();
    const dialog = await open();

    expect(
      within(dialog).getByRole("tablist", { name: "Panel sections" }),
    ).toBeDefined();
    expect(within(dialog).getAllByRole("tab")).toHaveLength(1);
  });
});

describe("small screen", () => {
  it("AC-15: the panel is modal, so the content behind it is not reachable", async () => {
    const { outside } = setup({ large: false });

    await open();

    await waitFor(() =>
      expect(outside.closest("[aria-hidden='true'], [inert]")).not.toBeNull(),
    );
  });

  it("AC-10: activating an entry shows its result and closes the panel", async () => {
    const entry = makeEntry(1, { text: "Zoom to Brno" });
    const { showResult } = setup({ entries: [entry] });
    const dialog = await open();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /Zoom to Brno/ }),
    );

    expect(showResult).toHaveBeenCalledExactlyOnceWith(entry.result);
    await waitFor(() => expect(panel()).toBeNull());
  });
});

describe("large screen", () => {
  it("AC-11: activating an entry shows its result and the panel stays open", async () => {
    const entry = makeEntry(1, { text: "Zoom to Brno" });
    const { showResult } = setup({ large: true, entries: [entry] });
    const dialog = await open();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /Zoom to Brno/ }),
    );

    expect(showResult).toHaveBeenCalledExactlyOnceWith(entry.result);
    expect(panel()).not.toBeNull();
  });

  it("AC-11: a click into the map beside the panel does not close it", async () => {
    const { outside } = setup({ large: true });
    await open();

    fireEvent.pointerDown(outside);
    fireEvent.mouseDown(outside);
    fireEvent.pointerUp(outside);
    fireEvent.click(outside);
    await act(async () => {});

    expect(panel()).not.toBeNull();
  });

  it("AC-11: the content beside the panel stays reachable", async () => {
    const { outside } = setup({ large: true });

    await open();

    expect(outside.closest("[aria-hidden='true'], [inert]")).toBeNull();
  });

  it("changing the screen size while open switches the layout without closing", async () => {
    const { media } = setup({ large: false });
    await open();

    act(() => media.setLarge(true));

    expect(panel()).not.toBeNull();
  });
});

describe("history tab", () => {
  const OLDER = makeEntry(1, {
    text: "Zoom to Brno",
    at: new Date(2020, 0, 5, 8, 15).getTime(),
  });
  const NEWER = makeEntry(2, { text: "Show Prague", at: Date.now() });

  it.each([
    ["cs", "Zatím žádné příkazy. Úspěšné příkazy se zobrazí zde."],
    ["en", "No commands yet. Successful commands will appear here."],
  ] as const)(
    "AC-2: the empty history shows the message in %s",
    async (locale, text) => {
      setup({ locale });
      const dialog = await open();

      expect(within(dialog).getByText(text)).toBeDefined();
      expect(within(dialog).queryByRole("list")).toBeNull();
    },
  );

  it("AC-3: lists the entries newest first with the typed text and a time", async () => {
    setup({ entries: [NEWER, OLDER] });
    const dialog = await open();

    const items = within(
      within(dialog).getByRole("list", { name: "Command history" }),
    ).getAllByRole("listitem");

    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toMatch(/^Show Prague/);
    expect(items[1]?.textContent).toMatch(/^Zoom to Brno/);
    expect(items[1]?.textContent).toMatch(/Jan 5, 2020/);
    expect(
      within(items[0] as HTMLElement).getByText(/\d/, { selector: "time" }),
    ).toBeDefined();
  });

  it("AC-9: activating an entry does not change the list", async () => {
    const { store } = setup({ large: true, entries: [NEWER, OLDER] });
    const dialog = await open();
    const before = store.getState().entries;

    fireEvent.click(
      within(dialog).getByRole("button", { name: /Zoom to Brno/ }),
    );

    expect(store.getState().entries).toBe(before);
    const items = within(dialog).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^Show Prague/),
      expect.stringMatching(/^Zoom to Brno/),
    ]);
  });

  it("AC-8: entries cannot be activated while a command request is running", async () => {
    const { store, showResult } = setup({ large: true, entries: [OLDER] });
    const dialog = await open();

    act(() => store.getState().setCommandInFlight(true));
    const button = within(dialog).getByRole("button", { name: /Zoom to Brno/ });
    fireEvent.click(button);

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(showResult).not.toHaveBeenCalled();
  });

  it("AC-13: entries cannot be activated while the map is not ready", async () => {
    setup({ large: true, entries: [OLDER], showResult: null });
    const dialog = await open();

    const button = within(dialog).getByRole("button", { name: /Zoom to Brno/ });

    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("AC-14: panel texts follow the language, entry text does not", async () => {
    setup({ locale: "cs", large: true, entries: [OLDER] });
    const dialog = await open();

    expect(dialog.getAttribute("aria-label")).toBe("Boční panel");
    expect(within(dialog).getByRole("tab", { name: "Historie" })).toBeDefined();
    expect(
      within(dialog).getByRole("button", { name: /Zoom to Brno/ }),
    ).toBeDefined();
    expect(
      within(dialog).getByRole("button", { name: "Zavřít boční panel" }),
    ).toBeDefined();
    expect(openControl().getAttribute("aria-label")).toBe(
      "Otevřít boční panel",
    );
  });
});
