import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bounds } from "@/shared/actions";
import { commandResponseSchema } from "@/shared/commandContract";
import type { Highlight } from "@/shared/highlightSchema";
import type { AiClient, AiResult } from "../ai/types";
import { type AppEnv, ConfigError } from "../config/env";
import type { Geocoder } from "../geocoding/types";
import { FakeClock } from "../state/fakeClock";
import { CommandLimits } from "../state/limits";
import { MemoryStateStore } from "../state/memoryStateStore";
import {
  COOLDOWN_MS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from "../state/rules";
import {
  type StateData,
  type StateStore,
  StateUnavailableError,
} from "../state/types";
import { createCommandHandler } from "./commandHandler";

const API_KEY = "gsk_test_key_not_real";
const ORIGIN = "https://geogrind.test";
const IP = "203.0.113.7";
const TEXT = "Přibliž na Brno";
const BRNO: Bounds = [
  [16.4283, 49.1096],
  [16.7283, 49.2946],
];

const ENV: AppEnv = {
  groqApiKey: API_KEY,
  groqModel: "test-model",
  geocoderUrl: "https://geo.test",
  geocoderContact: "ops@geogrind.test",
  clientIpHeader: "x-real-ip",
  appOrigins: [ORIGIN],
  stateDir: ".data",
  dailyCap: 100,
};

type Interpret = AiClient["interpret"];

class Harness {
  readonly clock = new FakeClock();
  readonly memory = new MemoryStateStore();
  readonly logs: unknown[] = [];
  readonly interpret = vi.fn<Interpret>(
    async (): Promise<AiResult> => ({
      kind: "output",
      output: { action: "zoom_to_place", place: "Brno" },
    }),
  );
  readonly find = vi.fn<Geocoder["find"]>(async () => ({ bounds: BRNO }));
  signal: AbortSignal = new AbortController().signal;
  store: StateStore = this.memory;
  loadEnv: () => AppEnv = () => ENV;

  private readonly handler = createCommandHandler({
    loadEnv: () => this.loadEnv(),
    createServices: (env) => ({
      ai: { interpret: this.interpret },
      geocoder: { find: this.find },
      limits: new CommandLimits(this.store, this.clock, env.dailyCap),
    }),
    createRequestSignal: () => this.signal,
    log: (entry) => this.logs.push(entry),
  });

  send(
    body: unknown = { text: TEXT, locale: "cs" },
    headers: Record<string, string> = {},
    init: Omit<RequestInit, "headers"> = {},
  ) {
    return this.raw(typeof body === "string" ? body : JSON.stringify(body), {
      headers,
      ...init,
    });
  }

  raw(
    body: BodyInit | null,
    init: Omit<RequestInit, "headers"> & {
      headers?: Record<string, string>;
    } = {},
  ) {
    return this.handler(
      new Request("https://geogrind.test/api/command", {
        method: "POST",
        body,
        ...init,
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "x-real-ip": IP,
          ...init.headers,
        },
      }),
    );
  }
}

async function readError(response: Response) {
  const body = await response.json();
  return v.parse(commandResponseSchema, body);
}

async function expectFailure(response: Response, status: number, code: string) {
  const body = await readError(response);
  expect(response.status).toBe(status);
  expect(body.ok).toBe(false);
  expect(body.ok ? undefined : body.error.code).toBe(code);
}

let h: Harness;
beforeEach(() => {
  h = new Harness();
});

describe("success", () => {
  it("AC-1: answers with the clipped bounds and starts the cooldown", async () => {
    const response = await h.send();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      result: { action: "zoom_to_place", bounds: BRNO },
      cooldownSeconds: 10,
    });
  });

  it("AC-1: forwards the geometry to highlight", async () => {
    const highlight: Highlight = { type: "Point", coordinates: [16.6, 49.2] };
    h.find.mockResolvedValue({ bounds: BRNO, highlight });

    const body = await (await h.send()).json();

    expect(body.result).toEqual({
      action: "zoom_to_place",
      bounds: BRNO,
      highlight,
    });
  });

  it("AC-28: the AI gets the text and language, the geocoder only the place", async () => {
    await h.send({ text: TEXT, locale: "en" });

    expect(h.interpret).toHaveBeenCalledOnce();
    expect(h.interpret.mock.calls[0]?.[0]).toEqual({
      text: TEXT,
      locale: "en",
    });
    expect(h.find.mock.calls[0]?.[0]).toBe("Brno");
    expect(h.find).toHaveBeenCalledOnce();
  });

  it("gives every answer no-store and no cross-origin headers", async () => {
    const response = await h.send();

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(
      [...response.headers.keys()].filter((name) =>
        name.startsWith("access-control-"),
      ),
    ).toEqual([]);
  });
});

describe("guard (no AI call for any of these)", () => {
  it.each([
    ["GET", 405],
    ["PUT", 405],
    ["DELETE", 405],
  ])("AC-7: rejects method %s", async (method, status) => {
    const response = await h.raw(null, { method });

    await expectFailure(response, status, "invalid_request");
    expect(response.headers.get("allow")).toBe("POST");
    expect(h.interpret).not.toHaveBeenCalled();
  });

  it("AC-7: rejects a foreign origin", async () => {
    const response = await h.send(undefined, { origin: "https://evil.test" });

    await expectFailure(response, 403, "invalid_request");
    expect(h.interpret).not.toHaveBeenCalled();
  });

  it("AC-7: rejects a request without an origin", async () => {
    const response = await h.send(undefined, { origin: "" });

    await expectFailure(response, 403, "invalid_request");
  });

  it.each(["text/plain", "application/x-www-form-urlencoded", ""])(
    "AC-7: rejects content type %j",
    async (contentType) => {
      const response = await h.send(undefined, { "content-type": contentType });

      await expectFailure(response, 415, "invalid_request");
      expect(h.interpret).not.toHaveBeenCalled();
    },
  );

  it("accepts a charset parameter on the content type", async () => {
    const response = await h.send(undefined, {
      "content-type": "application/json; charset=utf-8",
    });

    expect(response.status).toBe(200);
  });

  it("AC-6: rejects a body over 1 KB", async () => {
    const response = await h.send({
      text: TEXT,
      locale: "cs",
      pad: "x".repeat(2000),
    });

    await expectFailure(response, 413, "invalid_request");
    expect(h.interpret).not.toHaveBeenCalled();
  });

  it("AC-6: rejects an oversized body that lies about its length", async () => {
    const response = await h.send(
      JSON.stringify({ text: "x".repeat(5000), locale: "cs" }),
      { "content-length": "10" },
    );

    await expectFailure(response, 413, "invalid_request");
    expect(h.interpret).not.toHaveBeenCalled();
  });
});

describe("validation (no AI call for any of these)", () => {
  it.each([
    ["missing text", { locale: "cs" }],
    ["missing locale", { text: TEXT }],
    ["non-text text", { text: 5, locale: "cs" }],
    ["extra field", { text: TEXT, locale: "cs", role: "admin" }],
    ["unknown locale", { text: TEXT, locale: "de" }],
    ["201 characters", { text: "a".repeat(201), locale: "cs" }],
    ["a line break", { text: "Zoom\nBrno", locale: "cs" }],
    ["a zero-width character", { text: "Br​no", locale: "cs" }],
    ["a bidi override", { text: "‮Brno", locale: "cs" }],
    ["untrimmed text", { text: " Brno ", locale: "cs" }],
    ["empty text", { text: "", locale: "cs" }],
    ["a JSON array", ["Brno"]],
    ["JSON null", null],
    ["not JSON", "{ text:"],
  ])("AC-4, AC-5, AC-6: rejects %s", async (_name, body) => {
    const response = await h.send(body);

    await expectFailure(response, 400, "invalid_request");
    expect(h.interpret).not.toHaveBeenCalled();
    expect(h.find).not.toHaveBeenCalled();
  });

  it("accepts exactly 200 characters", async () => {
    const response = await h.send({ text: "a".repeat(200), locale: "cs" });

    expect(response.status).toBe(200);
  });
});

describe("AC-8 key and configuration", () => {
  it("a missing key (invalid environment) gives the generic error and no AI call", async () => {
    h.loadEnv = () => {
      throw new ConfigError("Invalid environment variables: GROQ_API_KEY");
    };

    await expectFailure(await h.send(), 500, "error");
    expect(h.interpret).not.toHaveBeenCalled();
  });

  it("a rejected key (AI failure) gives the generic error without detail", async () => {
    h.interpret.mockRejectedValue(new Error(`401 invalid key ${API_KEY}`));

    const response = await h.send();
    const text = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(text).not.toContain(API_KEY);
    expect(text).not.toContain("401");
  });

  it("neither responses nor logs contain the key, the IP or the typed text", async () => {
    const responses = [
      await h.send(),
      await h.send(undefined, { "x-real-ip": "198.51.100.1" }),
    ];
    h.interpret.mockRejectedValue(new Error(`${API_KEY} ${TEXT} ${IP}`));
    h.clock.advance(COOLDOWN_MS);
    responses.push(await h.send());

    const everything = JSON.stringify([
      h.logs,
      ...(await Promise.all(responses.map((response) => response.text()))),
    ]);
    for (const secret of [API_KEY, IP, "198.51.100.1", TEXT, "Brno"]) {
      expect(everything).not.toContain(secret);
    }
  });

  it("logs the result code and duration, plus the error class on errors", async () => {
    await h.send();
    h.clock.advance(COOLDOWN_MS);
    h.interpret.mockRejectedValue(new TypeError("fetch failed"));
    await h.send();

    expect(h.logs).toEqual([
      { code: "ok", durationMs: expect.any(Number) },
      { code: "error", durationMs: expect.any(Number), cause: "TypeError" },
    ]);
  });
});

describe("client address", () => {
  it("AC-19: a forged x-forwarded-for does not escape the limit of the real address", async () => {
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "unsupported" },
    });
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await h.send(undefined, { "x-forwarded-for": `198.51.100.${i}` });
    }

    const response = await h.send(undefined, {
      "x-forwarded-for": "198.51.100.99",
    });

    await expectFailure(response, 429, "too_many_requests");
  });

  it("AC-19: a missing trusted header is an error, not a fallback", async () => {
    const response = await h.send(undefined, { "x-real-ip": "" });

    await expectFailure(response, 500, "error");
    expect(h.interpret).not.toHaveBeenCalled();
  });

  it("uses x-forwarded-for when no header is named (development)", async () => {
    h.loadEnv = () => ({ ...ENV, clientIpHeader: undefined });

    const response = await h.send(undefined, {
      "x-real-ip": "",
      "x-forwarded-for": "198.51.100.5",
    });

    expect(response.status).toBe(200);
  });
});

describe("cooldown", () => {
  it("AC-12: 9 s after a success the server says wait without calling the AI", async () => {
    await h.send();
    h.clock.advance(9_000);

    const response = await h.send();

    await expectFailure(response, 429, "wait");
    expect(response.headers.get("retry-after")).toBe("1");
    expect(h.interpret).toHaveBeenCalledOnce();
  });

  it("AC-12: carries the remaining seconds", async () => {
    await h.send();
    h.clock.advance(4_000);

    const body = await (await h.send()).json();

    expect(body.error).toEqual({ code: "wait", retryAfterSeconds: 6 });
  });

  it("AC-12: 10 s after a success the request is accepted", async () => {
    await h.send();
    h.clock.advance(10_000);

    expect((await h.send()).status).toBe(200);
    expect(h.interpret).toHaveBeenCalledTimes(2);
  });

  it("AC-12: is the same for any language", async () => {
    await h.send({ text: TEXT, locale: "cs" });

    const response = await h.send({ text: "Zoom to Brno", locale: "en" });

    await expectFailure(response, 429, "wait");
  });

  it("another client is not affected", async () => {
    await h.send();

    const response = await h.send(undefined, { "x-real-ip": "203.0.113.8" });

    expect(response.status).toBe(200);
  });
});

describe("rate limit", () => {
  it("AC-13: the 11th request within a minute is refused with the wait time and no AI call", async () => {
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "unsupported" },
    });
    // Only the first reaches the AI; the others are turned away by the cooldown, but all count.
    for (let i = 0; i < RATE_LIMIT_MAX; i++) await h.send();

    const response = await h.send();

    await expectFailure(response, 429, "too_many_requests");
    expect(response.headers.get("retry-after")).toBe("60");
    expect(h.interpret).toHaveBeenCalledOnce();
  });

  it("AC-13: works again after the wait", async () => {
    for (let i = 0; i <= RATE_LIMIT_MAX; i++) await h.send({ nope: 1 });
    h.clock.advance(RATE_LIMIT_WINDOW_MS);

    expect((await h.send()).status).toBe(200);
  });

  it("counts invalid requests too", async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) await h.send({ nope: 1 });

    await expectFailure(await h.send(), 429, "too_many_requests");
  });

  it("does not count requests rejected by the guard", async () => {
    for (let i = 0; i < RATE_LIMIT_MAX + 5; i++) {
      await h.send(undefined, { origin: "https://evil.test" });
    }

    expect((await h.send()).status).toBe(200);
  });
});

describe("concurrency", () => {
  it("AC-29: of two simultaneous requests at most one reaches the AI", async () => {
    let finish: (result: AiResult) => void = () => {};
    h.interpret.mockImplementation(
      () => new Promise<AiResult>((resolve) => (finish = resolve)),
    );

    const first = h.send();
    await vi.waitFor(() => expect(h.interpret).toHaveBeenCalledOnce());
    const second = await h.send();
    finish({
      kind: "output",
      output: { action: "zoom_to_place", place: "Brno" },
    });

    await expectFailure(second, 429, "too_many_requests");
    expect((await first).status).toBe(200);
    expect(h.interpret).toHaveBeenCalledOnce();
  });
});

// Every admitted command starts the cooldown, so failed attempts cannot be repeated at once.
async function expectCooldown() {
  await expectFailure(await h.send(), 429, "wait");
  h.clock.advance(COOLDOWN_MS);
}

describe("failed commands also start the cooldown", () => {
  beforeEach(() => {
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "unsupported" },
    });
  });

  it("AC-15: an unsupported command is answered and starts the cooldown", async () => {
    const response = await h.send({
      text: "Show cycling routes",
      locale: "en",
    });

    expect((await response.clone().json()).error.cooldownSeconds).toBe(
      COOLDOWN_MS / 1000,
    );
    await expectFailure(response, 200, "unsupported");
    expect(h.find).not.toHaveBeenCalled();
    await expectCooldown();
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "zoom_to_place", place: "Brno" },
    });
    expect((await h.send()).status).toBe(200);
  });

  it("AC-16: a place the geocoder does not know is not found, with cooldown", async () => {
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "zoom_to_place", place: "Neexistující Lhota" },
    });
    h.find.mockResolvedValue(null);

    await expectFailure(await h.send(), 200, "not_found");
    await expectCooldown();
    h.find.mockResolvedValue({ bounds: BRNO });
    expect((await h.send()).status).toBe(200);
  });

  it("AC-1: a place abroad is zoomed to like any other", async () => {
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "zoom_to_place", place: "Vienna" },
    });
    h.find.mockResolvedValue({
      bounds: [
        [16.18, 48.1],
        [16.58, 48.32],
      ],
    });

    const response = await h.send();

    expect(response.status).toBe(200);
    expect((await response.json()).result.bounds).toEqual([
      [16.18, 48.1],
      [16.58, 48.32],
    ]);
  });

  it("AC-17: an AI failure is the generic error, with cooldown", async () => {
    h.interpret.mockRejectedValueOnce(new Error("Groq answered 503"));

    await expectFailure(await h.send(), 500, "error");
    await expectCooldown();
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "zoom_to_place", place: "Brno" },
    });
    expect((await h.send()).status).toBe(200);
  });

  it("AC-17: a geocoder failure is the generic error, with cooldown", async () => {
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "zoom_to_place", place: "Brno" },
    });
    h.find.mockRejectedValueOnce(new Error("Geocoder answered 429"));

    await expectFailure(await h.send(), 500, "error");
    await expectCooldown();
    expect((await h.send()).status).toBe(200);
  });

  it("AC-3, AC-17: a request that runs out of its time budget is the generic error", async () => {
    const controller = new AbortController();
    h.signal = controller.signal;
    h.interpret.mockImplementation(
      (_input, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    );

    const pending = h.send();
    await vi.waitFor(() => expect(h.interpret).toHaveBeenCalledOnce());
    controller.abort(new DOMException("timeout", "TimeoutError"));

    await expectFailure(await pending, 500, "error");
    expect(h.logs.at(-1)).toMatchObject({ cause: "TimeoutError" });
    await expectCooldown();
    h.signal = new AbortController().signal;
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "zoom_to_place", place: "Brno" },
    });
    expect((await h.send()).status).toBe(200);
  });
});

describe("AI quota", () => {
  it("AC-18: an exhausted quota is reported with the reset time, blocks the AI and starts no cooldown", async () => {
    h.interpret.mockResolvedValueOnce({
      kind: "quota_exhausted",
      retryAfterSeconds: 120,
    });

    const first = await h.send();
    const body = await first.json();
    expect(first.status).toBe(503);
    expect(body.error).toEqual({
      code: "ai_resting",
      resetAt: new Date(h.clock.now() + 120_000).toISOString(),
    });

    await expectFailure(await h.send(), 503, "ai_resting");
    expect(h.interpret).toHaveBeenCalledOnce();
  });

  it("AC-18: the AI is called again once the retry time has passed", async () => {
    h.interpret.mockResolvedValueOnce({
      kind: "quota_exhausted",
      retryAfterSeconds: 120,
    });
    await h.send();
    h.clock.advance(120_000);

    expect((await h.send()).status).toBe(200);
  });

  it("AC-18: the daily cap stops the AI and the next UTC day resets it", async () => {
    h.interpret.mockResolvedValue({
      kind: "output",
      output: { action: "unsupported" },
    });
    h.loadEnv = () => ({ ...ENV, dailyCap: 5 });
    for (let i = 0; i < 5; i++) {
      await h.send();
      h.clock.advance(COOLDOWN_MS);
    }
    h.interpret.mockClear();

    const rested = await h.send();
    const body = await rested.json();

    expect(rested.status).toBe(503);
    expect(body.error).toEqual({
      code: "ai_resting",
      resetAt: new Date(Date.UTC(2026, 10, 10)).toISOString(),
    });
    expect(h.interpret).not.toHaveBeenCalled();

    h.clock.set(Date.UTC(2026, 10, 10, 0, 0, 1));
    await h.send();
    expect(h.interpret).toHaveBeenCalledOnce();
  });
});

describe("state problems", () => {
  const broken: StateStore = {
    async transact(): Promise<never> {
      throw new StateUnavailableError("corrupt");
    },
  };

  it("AC-29: unavailable state means the generic error and no AI call", async () => {
    h.store = broken;

    await expectFailure(await h.send(), 500, "error");
    expect(h.interpret).not.toHaveBeenCalled();
    expect(h.logs.at(-1)).toMatchObject({ cause: "StateUnavailableError" });
  });

  it("state read after a success is persisted for later requests", async () => {
    await h.send();

    const snapshot: StateData = h.memory.snapshot();

    expect(Object.keys(snapshot.clients)).toEqual([IP]);
  });
});
