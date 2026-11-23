import { act, cleanup, render, screen, within } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocaleSwitch } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/routing";
import type { MapAvailability } from "@/map";
import type { MetricsSnapshot } from "@/shared/metricsContract";
import { makeSnapshot, SERVER_NOW } from "@/test/metricsSnapshot";
import { MapAvailabilityContext } from "../map/mapAvailability";
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

/** Stands in for MapView: drives the map state of this browser. */
function MapState({ children }: { children: ReactNode }) {
  const [availability, setAvailability] = useState<MapAvailability>("unknown");
  return (
    <MapAvailabilityContext value={availability}>
      {(["available", "unavailable"] as const).map((next) => (
        <button key={next} type="button" onClick={() => setAvailability(next)}>
          {`map ${next}`}
        </button>
      ))}
      {children}
    </MapAvailabilityContext>
  );
}

async function setup(locale: Locale = "en") {
  render(
    <LocaleProvider initialLocale={locale}>
      <LanguageButton to={locale === "en" ? "cs" : "en"} />
      <MapState>
        <MetricsTab />
      </MapState>
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
    // The heading of the AI group shares a row with the model line, so the group is one level up.
    const aiGroup = screen.getByRole("heading", { level: 2, name: "AI" })
      .parentElement?.parentElement;
    expect(
      within(aiGroup as HTMLElement).getAllByRole("separator"),
    ).toHaveLength(3);
  });
});

describe("empty and partly known states", () => {
  it("AC-11: before the first request the tab explains, but still shows the model and the cap", async () => {
    stubFetch(makeSnapshot({ lastRequest: null, limits: null }));
    await setup();

    expect(
      screen.getByText("Data appears after the first command."),
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

const FRESH_APP = {
  results: {
    success: 0,
    unsupported: 0,
    not_found: 0,
    wait: 0,
    too_many_requests: 0,
    ai_resting: 0,
    error: 0,
  },
  load: { lastMinute: 0, lastHour: null, activeClients: null, inProgress: 0 },
  latency: null,
  services: { nominatim: null },
};

const groupOf = (name: string) => {
  const group = screen.getByRole("heading", { level: 2, name }).parentElement;
  if (!group) throw new Error(`no group ${name}`);
  return group;
};
const appGroup = () => groupOf("Application");
const appRegion = (name: string) =>
  within(appGroup()).getByRole("region", { name });
const legendRows = () =>
  within(appRegion("Commands today"))
    .getAllByRole("listitem")
    .map((row) => text(row));
const light = (service: string) => {
  const row = within(appGroup())
    .getAllByRole("listitem")
    .find((item) => item.textContent === service);
  if (!row) throw new Error(`no light for ${service}`);
  return within(row).getByRole("img");
};
const slicesOf = (pie: Element) => pie.querySelectorAll(":scope > path");
const clickButton = (name: string) =>
  act(() => screen.getByRole("button", { name }).click());

describe("application group", () => {
  it("AC-1: comes before the AI group", async () => {
    stubFetch(makeSnapshot());
    await setup();

    const ai = screen.getByRole("heading", { level: 2, name: "AI" });
    const app = screen.getByRole("heading", { level: 2, name: "Application" });
    expect(
      app.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("AC-21: order is services, results, latency, load, with dividers between them", async () => {
    stubFetch(makeSnapshot());
    await setup();

    const group = appGroup();
    expect(
      within(group)
        .getAllByRole("region")
        .map((region) => region.querySelector("h3")?.textContent),
    ).toEqual([
      "Service status",
      "Commands today",
      "Processing time (last hour)",
      "Load",
    ]);
    // Three between the items; the full-width one is owned by the tab.
    expect(within(group).getAllByRole("separator")).toHaveLength(3);
    expect(group.lastElementChild?.tagName).not.toBe("HR");
  });

  it("AC-2: the legend lists all seven results with counts and percentages; the pie is SVG", async () => {
    stubFetch(makeSnapshot());
    await setup();

    expect(legendRows()).toEqual([
      "Successful660%",
      "Unsupported00%",
      "Place not found220%",
      "Too early (pause)110%",
      "Too many cmds00%",
      "AI resting00%",
      "Error110%",
    ]);
    const pie = within(appRegion("Commands today")).getByRole("img");
    expect(pie.tagName).toBe("svg");
    expect(slicesOf(pie)).toHaveLength(4);
  });

  it("AC-4: the pie's text equivalent lists every result with its count", async () => {
    stubFetch(makeSnapshot());
    await setup();

    const pie = within(appRegion("Commands today")).getByRole("img");
    expect(pie.getAttribute("aria-label")).toBe(
      "Results of today's commands: Successful: 6 (60%), Unsupported: 0 (0%), " +
        "Place not found: 2 (20%), Too early (pause): 1 (10%), Too many cmds: 0 (0%), " +
        "AI resting: 0 (0%), and Error: 1 (10%)",
    );
  });

  it("AC-3: only successful commands draw one full circle at 100 %", async () => {
    stubFetch(
      makeSnapshot({}, SERVER_NOW, {
        results: { ...FRESH_APP.results, success: 3 },
      }),
    );
    await setup();

    const pie = within(appRegion("Commands today")).getByRole("img");
    expect(slicesOf(pie)).toHaveLength(1);
    expect(slicesOf(pie)[0]?.getAttribute("d")).toBe(
      "M 50 1 A 49 49 0 1 1 50 99 A 49 49 0 1 1 50 1 Z",
    );
    expect(legendRows()[0]).toBe("Successful3100%");
  });

  it("AC-5: shows median and p95 and a sparkline with a text equivalent", async () => {
    stubFetch(makeSnapshot());
    await setup();

    const latency = appRegion("Processing time (last hour)");
    expect(text(latency)).toContain("Median820 ms");
    expect(text(latency)).toContain("95th percentile1.5 sec");
    const sparkline = within(latency).getByRole("img");
    expect(sparkline.getAttribute("aria-label")).toBe(
      "Processing time per 5 min over the last 60 min: median 820 ms, 95th percentile 1.5 sec, 8 commands.",
    );
    expect(sparkline.querySelectorAll("path, circle").length).toBeGreaterThan(
      1,
    );
  });

  it("AC-6: shows the load figures", async () => {
    stubFetch(
      makeSnapshot({}, SERVER_NOW, {
        load: { lastMinute: 1, lastHour: 3, activeClients: 3, inProgress: 1 },
      }),
    );
    await setup();

    expect(text(appRegion("Load"))).toBe(
      "LoadCommands in the last minute1Commands in the last hour3" +
        "Active clients (last hour)3Commands in progress1",
    );
  });

  it("AC-12: a fresh start shows no data for unknown figures and 0 only for known ones", async () => {
    stubFetch(
      makeSnapshot({}, SERVER_NOW, {
        ...FRESH_APP,
        window: {
          startedAt: SERVER_NOW - 30_000,
          durationMs: 3_600_000,
          bucketMs: 300_000,
        },
      }),
    );
    await setup();

    const results = appRegion("Commands today");
    expect(within(results).queryByRole("img")).toBeNull();
    expect(within(results).getByText("no data")).toBeDefined();
    expect(
      within(appRegion("Processing time (since start)")).getByText("no data"),
    ).toBeDefined();
    expect(text(appRegion("Load"))).toBe(
      "LoadCommands in the last minute0Commands since startno data" +
        "Active clients (since start)no dataCommands in progress0",
    );
    expect(text(appGroup())).not.toMatch(/\d\s?%/);
  });

  it("AC-19: during the first hour the hour figures say since start and the span is the real one", async () => {
    stubFetch(
      makeSnapshot({}, SERVER_NOW, {
        window: {
          startedAt: SERVER_NOW - 10 * 60_000,
          durationMs: 3_600_000,
          bucketMs: 300_000,
        },
      }),
    );
    await setup();

    const latency = appRegion("Processing time (since start)");
    expect(within(latency).getByRole("img").getAttribute("aria-label")).toMatch(
      /over the last 10 min/,
    );
    expect(text(appRegion("Load"))).toContain("Commands since start10");
    expect(text(appRegion("Load"))).toContain("Active clients (since start)3");
    // The pie is the whole day from the state file, so it keeps its plain title.
    expect(appRegion("Commands today")).toBeDefined();
  });

  it("AC-8: both services have a dot with a label and the native title", async () => {
    stubFetch(makeSnapshot({}, SERVER_NOW, { services: { nominatim: false } }));
    await setup();

    clickButton("map available");

    const map = light("Map");
    const nominatim = light("Nominatim");
    expect(map.getAttribute("title")).toBe("Service is available");
    expect(map.getAttribute("aria-label")).toBe("Service is available");
    expect(nominatim.getAttribute("title")).toBe("Service is not available");
    expect(map.className).toContain("bg-green-700");
    expect(nominatim.className).toContain("bg-red-700");
    expect(map.querySelector("svg")).toBeNull();
  });

  it("AC-11: an unknown Nominatim is a grey dot, neither green nor red and says data appears after the first command", async () => {
    stubFetch(makeSnapshot({}, SERVER_NOW, { services: { nominatim: null } }));
    await setup();

    const nominatim = light("Nominatim");
    expect(nominatim.getAttribute("title")).toBe("Status not known yet");
    expect(nominatim.className).toContain("bg-neutral-400");
    expect(
      within(appRegion("Service status")).getByText(
        "Data appears after the first command.",
      ),
    ).toBeDefined();
  });

  it("AC-9: the map light follows this browser's map without any fetch", async () => {
    const fetchStub = stubFetch(makeSnapshot());
    await setup();
    expect(light("Map").getAttribute("title")).toBe("Status not known yet");

    clickButton("map unavailable");
    expect(light("Map").getAttribute("title")).toBe("Service is not available");
    clickButton("map available");
    expect(light("Map").getAttribute("title")).toBe("Service is available");

    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("AC-13: a failed fetch keeps both groups, shows one banner, and the map light still changes", async () => {
    stubFetch(
      makeSnapshot(),
      "fail",
      makeSnapshot({}, SERVER_NOW, {
        load: { lastMinute: 2, lastHour: 42, activeClients: 5, inProgress: 0 },
      }),
    );
    await setup();

    await advance(10_000);
    expect(screen.getAllByText(/may be out of date/)).toHaveLength(1);
    expect(legendRows()[0]).toBe("Successful660%");
    clickButton("map unavailable");
    expect(light("Map").getAttribute("title")).toBe("Service is not available");

    await advance(10_000);
    expect(screen.queryByText(/out of date/)).toBeNull();
    expect(text(appRegion("Load"))).toContain("Commands in the last hour42");
  });

  it("AC-16: switching the language changes the group's texts and numbers without a fetch", async () => {
    const fetchStub = stubFetch(makeSnapshot());
    await setup("en");

    await act(async () => {
      screen.getByRole("button", { name: "switch" }).click();
    });

    const region = (name: string) =>
      within(groupOf("Aplikace")).getByRole("region", { name });
    expect(text(region("Příkazy dnes"))).toContain("Úspěšné660 %");
    expect(text(region("Doba zpracování (poslední hodina)"))).toContain(
      "95. percentil1,5 s",
    );
    expect(text(region("Zátěž"))).toContain("Příkazy za poslední hodinu10");
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});
