import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocaleSwitch } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/routing";
import type { MetricsSnapshot } from "@/shared/metricsContract";
import { makeSnapshot, SERVER_NOW } from "@/test/metricsSnapshot";
import { MetricsTab } from "./MetricsTab";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SERVER_NOW);
  vi.stubGlobal("cookieStore", { set: () => Promise.resolve() });
  window.history.replaceState(null, "", "/en");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Answer = MetricsSnapshot | "fail";

/** Answers the fetches in order; the last answer repeats. */
function stubFetch(...answers: Answer[]) {
  const queue = [...answers];
  const stub = vi.fn(async () => {
    const answer = queue.length > 1 ? queue.shift() : queue[0];
    if (answer === undefined || answer === "fail") {
      throw new TypeError("network down");
    }
    return Response.json({ ok: true, metrics: answer });
  });
  vi.stubGlobal("fetch", stub);
  return stub;
}

function LanguageButton({ to }: { to: Locale }) {
  const { setLocale } = useLocaleSwitch();
  return (
    <button type="button" onClick={() => setLocale(to)}>
      switch
    </button>
  );
}

async function setup(locale: Locale = "en") {
  render(
    <LocaleProvider initialLocale={locale}>
      <LanguageButton to={locale === "en" ? "cs" : "en"} />
      <MetricsTab />
    </LocaleProvider>,
  );
  await advance(0);
}

const advance = (milliseconds: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });

// Intl groups digits with non-breaking spaces.
const text = (element: Element | null) =>
  (element?.textContent ?? "").replace(/[  ]/g, " ");

/** The label is bold, so the line is split over two elements. */
const modelLine = (model: string) =>
  screen.getByText(
    (_, element) =>
      element?.tagName === "P" && element.textContent === `Model: ${model}`,
  );

const meter = (name: string) => screen.getByRole("meter", { name });
const fillOf = (element: HTMLElement) =>
  element.querySelector<HTMLElement>("[style*='width']")?.style.width;

describe("figures", () => {
  it("AC-2: shows prompt, completion and total of the last request", async () => {
    stubFetch(makeSnapshot());
    await setup();

    const last = screen.getByRole("region", { name: "Last request (tokens)" });
    const table = within(last).getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Input", "Output", "Total"]);
    expect(
      within(table)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["120", "30", "150"]);
  });

  it("AC-5, AC-18: the requests limit is a bar with name, value, range and period label", async () => {
    stubFetch(makeSnapshot());
    await setup();

    const requests = meter("Requests per day (Groq)");
    expect(requests.getAttribute("aria-valuenow")).toBe("480");
    expect(requests.getAttribute("aria-valuemin")).toBe("0");
    expect(requests.getAttribute("aria-valuemax")).toBe("500");
    expect(requests.getAttribute("aria-valuetext")).toBe(
      "480 of 500 remaining",
    );
    expect(fillOf(requests)).toBe("96%");
    expect(text(requests)).toContain("480 / 500");

    const tokens = meter("Tokens per minute");
    expect(tokens.getAttribute("aria-valuenow")).toBe("6000");
    expect(fillOf(tokens)).toBe("75%");
    expect(text(tokens)).toContain("6,000 / 8,000");
    expect(screen.queryByText(/per day.*token|token.*per day/i)).toBeNull();
  });

  it("AC-5: Czech numbers are grouped the Czech way", async () => {
    stubFetch(makeSnapshot());
    await setup("cs");

    expect(text(meter("Tokeny za minutu"))).toContain("6 000 / 8 000");
    expect(text(meter("Požadavky za den (Groq)"))).toContain("480 / 500");
  });

  it("AC-9: shows the cap of the app with a bar and the time to the next UTC day", async () => {
    stubFetch(makeSnapshot());
    await setup();

    const cap = meter("AI requests");
    expect(text(cap)).toContain("37 / 500");
    expect(cap.getAttribute("aria-valuemax")).toBe("500");
    expect(screen.getByText("Renewal in 12h 00m 00s")).toBeDefined();
  });

  it("AC-9: a reached cap shows a full bar", async () => {
    const snapshot = makeSnapshot();
    stubFetch({
      ...snapshot,
      ai: { ...snapshot.ai, dailyCap: { ...snapshot.ai.dailyCap, used: 500 } },
    });
    await setup();

    const cap = meter("AI requests");
    expect(text(cap)).toContain("500 / 500");
    expect(fillOf(cap)).toBe("100%");
  });

  it("FR-3, FR-9, AC-10: shows the day's tokens and the model as is", async () => {
    stubFetch(makeSnapshot({ model: "openai/gpt-oss-20b", dailyTokens: 1234 }));
    await setup();

    expect(
      text(
        screen.getByRole("region", {
          name: "Tokens used today (all users)",
        }),
      ),
    ).toContain("1,234");
    expect(modelLine("openai/gpt-oss-20b")).toBeDefined();
  });

  it("AC-6: order is model line, cap, last request, requests per day, tokens per minute, tokens today", async () => {
    stubFetch(makeSnapshot());
    await setup();

    const order = [
      modelLine("test-model"),
      screen.getByRole("meter", { name: "AI requests" }),
      screen.getByRole("region", { name: "Last request (tokens)" }),
      screen.getByRole("meter", { name: "Requests per day (Groq)" }),
      screen.getByRole("meter", { name: "Tokens per minute" }),
      screen.getByRole("region", { name: "Tokens used today (all users)" }),
    ];
    order.slice(1).forEach((element, index) => {
      expect(
        (order[index]?.compareDocumentPosition(element) ?? 0) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(screen.getAllByRole("separator")).toHaveLength(4);
  });
});

describe("motion", () => {
  it("AC-19: the bars opt out of their transition for reduced motion", async () => {
    stubFetch(makeSnapshot());
    await setup();

    const indicator = meter("Requests per day (Groq)").querySelector(
      "[style*='width']",
    );

    expect(indicator?.className).toContain("motion-reduce:transition-none");
  });
});

describe("empty and partly known states", () => {
  it("AC-11: before the first request the tab explains, but still shows the model and the cap", async () => {
    stubFetch(makeSnapshot({ lastRequest: null, limits: null }));
    await setup();

    expect(
      screen.getByText("The figures of the AI appear after the first command."),
    ).toBeDefined();
    expect(modelLine("test-model")).toBeDefined();
    expect(screen.getAllByRole("meter")).toHaveLength(1);
    expect(screen.queryByText("Requests per day (Groq)")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Last request (tokens)" }),
    ).toBeNull();
  });

  it("AC-12: unknown parts say no data, with no bar and no 0 or 100 % stand-in", async () => {
    stubFetch(
      makeSnapshot({
        lastRequest: {
          at: SERVER_NOW,
          prompt: null,
          completion: null,
          total: 150,
        },
        limits: {
          receivedAt: SERVER_NOW,
          requests: { remaining: null, limit: null, resetsAt: null },
          tokens: { remaining: 6000, limit: 8000, resetsAt: null },
        },
      }),
    );
    await setup();

    const last = screen.getByRole("region", { name: "Last request (tokens)" });
    expect(
      within(last)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["no data", "no data", "150"]);

    expect(
      screen.queryByRole("meter", { name: "Requests per day (Groq)" }),
    ).toBeNull();
    expect(text(document.body)).toContain("Requests per day (Groq)no data");
    expect(screen.getAllByText("Renewal time: unknown")).toHaveLength(2);
    expect(screen.getAllByRole("meter")).toHaveLength(2);
  });
});

/** The requests limit renews 8 s after the answer. */
const renewsSoon = (serverNow = SERVER_NOW) =>
  makeSnapshot(
    {
      limits: {
        receivedAt: serverNow,
        requests: { remaining: 480, limit: 500, resetsAt: serverNow + 8_000 },
        tokens: { remaining: 6000, limit: 8000, resetsAt: null },
      },
    },
    serverNow,
  );

describe("countdown", () => {
  it("AC-8, AC-18: counts down without new requests and ends as renewed, announced once", async () => {
    const fetchStub = stubFetch(renewsSoon());
    await setup();
    expect(screen.getByText("Renews in 8 sec")).toBeDefined();
    expect(screen.queryAllByRole("status")).toHaveLength(0);

    await advance(3_000);
    expect(screen.getByText("Renews in 5 sec")).toBeDefined();
    expect(screen.queryAllByRole("status")).toHaveLength(0);
    expect(fetchStub).toHaveBeenCalledTimes(1);

    await advance(5_000);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(
      "Renewed. The figure is out of date until the next command.",
    );
    expect(
      screen.queryByRole("meter", { name: "Requests per day (Groq)" }),
    ).toBeNull();
    expect(text(document.body)).not.toContain("480 / 500");
  });

  it("FR-6: counts from the server's clock, not a wrong device clock", async () => {
    stubFetch(renewsSoon(SERVER_NOW + 3_600_000));
    await setup();

    expect(screen.getByText("Renews in 8 sec")).toBeDefined();
  });
});

describe("loading and failures", () => {
  it("shows a loading text before the first answer", async () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    await setup();

    expect(screen.getByText("Loading figures…")).toBeDefined();
  });

  it("AC-14: a failed first load says so and recovers by itself", async () => {
    stubFetch("fail", makeSnapshot());
    await setup();
    expect(
      screen.getByText("The figures could not be loaded. Trying again."),
    ).toBeDefined();

    await advance(10_000);

    expect(modelLine("test-model")).toBeDefined();
    expect(screen.queryByText(/could not be loaded/)).toBeNull();
  });

  it("AC-14: a later failure keeps the figures, marks them out of date and recovers", async () => {
    stubFetch(makeSnapshot(), "fail", makeSnapshot({ dailyTokens: 999 }));
    await setup();

    await advance(10_000);
    expect(
      screen.getByText(/could not be updated and may be out of date/),
    ).toBeDefined();
    expect(screen.getByText("270")).toBeDefined();

    await advance(10_000);
    expect(screen.queryByText(/out of date/)).toBeNull();
    expect(screen.getByText("999")).toBeDefined();
  });

  it("AC-14: a malformed answer counts as a failure", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ ok: true, metrics: {} }),
    );
    await setup();

    expect(screen.getByText(/could not be loaded/)).toBeDefined();
  });
});

describe("language", () => {
  it("AC-17: switching the language re-renders texts and numbers without a fetch", async () => {
    const fetchStub = stubFetch(makeSnapshot());
    await setup("en");
    expect(text(meter("Tokens per minute"))).toContain("6,000 / 8,000");

    await act(async () => {
      screen.getByRole("button", { name: "switch" }).click();
    });

    expect(text(meter("Požadavky za den (Groq)"))).toContain("480 / 500");
    expect(screen.getByText("Poslední požadavek (tokeny)")).toBeDefined();
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});

describe("privacy", () => {
  it("AC-15: nothing is written to the browser's storage", async () => {
    stubFetch(makeSnapshot());
    await setup();

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
