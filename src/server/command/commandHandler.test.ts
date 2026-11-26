import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bounds } from "@/shared/actions";
import { commandResponseSchema } from "@/shared/commandContract";
import type { Highlight } from "@/shared/highlightSchema";
import { FakeClock } from "@/test/fakeClock";
import { createFakeRandomBytes } from "@/test/fakeRandomBytes";
import { MemoryStateStore } from "@/test/memoryStateStore";
import type { AiClient, AiResult } from "../ai/types";
import { type AppEnv, ConfigError } from "../config/env";
import type { Geocoder } from "../geocoding/types";
import {
  type CommandMeasurementRecorder,
  createCommandMeasurement,
} from "../metrics/app/commandMeasurement";
import { CommandWindow } from "../metrics/app/commandWindow";
import {
  createClientKeyring,
  type Pseudonymizer,
} from "../privacy/clientKeyring";
import { CommandLimits } from "../state/limits";
import { COOLDOWN_MS, RATE_LIMIT_MAX } from "../state/rules";
import { type StateStore, StateUnavailableError } from "../state/types";
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
  readonly measurement = vi.fn<CommandMeasurementRecorder>();
  keyring = this.newKeyring(1);
  readonly pseudonymize = vi.fn<Pseudonymizer>((clientId) =>
    this.keyring.pseudonymize(clientId),
  );
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
    measurement: (entry) => this.measurement(entry),
    pseudonymize: (clientId) => this.pseudonymize(clientId),
  });

  /** A server restart as the keyring sees it: the key is lost, the state store stays. */
  restart() {
    this.keyring = this.newKeyring(2);
  }

  private newKeyring(seed: number) {
    return createClientKeyring({
      clock: this.clock,
      randomBytes: createFakeRandomBytes(seed).randomBytes,
    });
  }

  /** The pseudonym the handler uses for `ip` under the current key. */
  pseudonymOf(ip = IP) {
    return this.keyring.pseudonymize(ip);
  }

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
  it.each([["GET", 405]])("AC-7: rejects method %s", async (method, status) => {
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

  it.each(["text/plain", ""])(
    "AC-7: rejects content type %j",
    async (contentType) => {
      const response = await h.send(undefined, { "content-type": contentType });

      await expectFailure(response, 415, "invalid_request");
      expect(h.interpret).not.toHaveBeenCalled();
    },
  );

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
    ["extra field", { text: TEXT, locale: "cs", role: "admin" }],
    ["unknown locale", { text: TEXT, locale: "de" }],
    ["201 characters", { text: "a".repeat(201), locale: "cs" }],
    ["a line break", { text: "Zoom\nBrno", locale: "cs" }],
    ["a zero-width character", { text: "Br​no", locale: "cs" }],
    ["a bidi override", { text: "‮Brno", locale: "cs" }],
    ["untrimmed text", { text: " Brno ", locale: "cs" }],
    ["not JSON", "{ text:"],
  ])("AC-4, AC-5, AC-6: rejects %s", async (_name, body) => {
    const response = await h.send(body);

    await expectFailure(response, 400, "invalid_request");
    expect(h.interpret).not.toHaveBeenCalled();
    expect(h.find).not.toHaveBeenCalled();
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
});

describe("cooldown", () => {
  it("AC-12: 4 s after a success the server says wait with the remaining seconds, without calling the AI", async () => {
    await h.send();
    h.clock.advance(4_000);

    const response = await h.send();

    await expectFailure(response, 429, "wait");
    expect(response.headers.get("retry-after")).toBe("6");
    expect(h.interpret).toHaveBeenCalledOnce();
  });

  it("AC-12: 10 s after a success the request is accepted", async () => {
    await h.send();
    h.clock.advance(10_000);

    expect((await h.send()).status).toBe(200);
    expect(h.interpret).toHaveBeenCalledTimes(2);
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
    async read(): Promise<never> {
      throw new StateUnavailableError("corrupt");
    },
  };

  it("AC-29: unavailable state means the generic error and no AI call", async () => {
    h.store = broken;

    await expectFailure(await h.send(), 500, "error");
    expect(h.interpret).not.toHaveBeenCalled();
    expect(h.logs.at(-1)).toMatchObject({ cause: "StateUnavailableError" });
  });
});

describe("metrics measurement (spec 010)", () => {
  const measured = () =>
    h.measurement.mock.calls.map(([entry]) => entry.result);

  it("FR-2: a successful command is measured once as success with its duration and client", async () => {
    await h.send();

    expect(h.measurement).toHaveBeenCalledExactlyOnceWith({
      result: "success",
      durationMs: expect.any(Number),
      clientId: h.pseudonymOf(IP),
    });
  });

  it("FR-2: every processed result is measured with its code", async () => {
    h.interpret.mockResolvedValueOnce({
      kind: "output",
      output: { action: "unsupported" },
    });
    await h.send();
    await h.send();
    h.clock.advance(COOLDOWN_MS);
    h.find.mockResolvedValueOnce(null);
    await h.send();
    h.clock.advance(COOLDOWN_MS);
    h.interpret.mockRejectedValueOnce(new Error("Groq answered 503"));
    await h.send();
    h.clock.advance(COOLDOWN_MS);
    h.interpret.mockResolvedValueOnce({
      kind: "quota_exhausted",
      retryAfterSeconds: 60,
    });
    await h.send();

    expect(measured()).toEqual([
      "unsupported",
      "wait",
      "not_found",
      "error",
      "ai_resting",
    ]);
  });

  it("FR-2: a refused request over the rate limit is measured as too_many_requests", async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) await h.send({ nope: 1 });

    await h.send();

    expect(measured()).toEqual(["too_many_requests"]);
  });

  it.each([
    ["a bad body", () => h.send({ nope: 1 })],
    ["a foreign origin", () => h.send(undefined, { origin: "https://x.test" })],
    ["another method", () => h.raw(null, { method: "GET" })],
  ])("AC-3: %s (invalid_request) is not measured", async (_name, send) => {
    await send();

    expect(h.measurement).not.toHaveBeenCalled();
  });

  it("AC-15: a throwing measurement leaves the answer and the log unchanged", async () => {
    const plain = await (await h.send()).json();
    h.clock.advance(COOLDOWN_MS);
    h.measurement.mockImplementation(() => {
      throw new Error("metrics broken");
    });

    const response = await h.send();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(plain);
    expect(h.logs.at(-1)).toEqual({
      code: "ok",
      durationMs: expect.any(Number),
    });
  });
});

describe("client pseudonyms (spec 011)", () => {
  const IPV6 = "2001:db8:1:2:3:4:5:6";

  function withRealMeasurement() {
    const window = new CommandWindow({ clock: h.clock });
    h.measurement.mockImplementation(
      createCommandMeasurement({
        window,
        openStore: () => h.memory,
        clock: h.clock,
        log: () => {},
      }),
    );
    return window;
  }

  it("AC-1, AC-9: the state and the window get the same pseudonym, never the IP", async () => {
    const window = withRealMeasurement();

    await h.send();

    const pseudonym = h.pseudonymOf(IP);
    expect(Object.keys(h.memory.snapshot().clients)).toEqual([pseudonym]);
    expect(h.measurement.mock.calls[0]?.[0].clientId).toBe(pseudonym);
    expect(JSON.stringify(window)).toContain(pseudonym);
    expect(JSON.stringify([h.memory.snapshot(), window])).not.toContain(IP);
  });

  it("AC-1: neither an IPv6 address nor its /64 prefix reaches the state or the window", async () => {
    const window = withRealMeasurement();

    await h.send(undefined, { "x-real-ip": IPV6 });

    const stored = JSON.stringify([h.memory.snapshot(), window]);
    expect(Object.keys(h.memory.snapshot().clients)).toEqual([
      h.pseudonymOf("2001:0db8:0001:0002::/64"),
    ]);
    for (const part of ["2001:db8", "2001:0db8", "::/64"]) {
      expect(stored).not.toContain(part);
    }
  });

  it("AC-2: a failed command leaves no IP in the state, the window, the logs or the answer", async () => {
    const window = withRealMeasurement();
    h.interpret.mockRejectedValue(new Error(`failed for ${IP}`));

    const response = await h.send();

    const everything = JSON.stringify([
      h.memory.snapshot(),
      window,
      window.summary(),
      h.logs,
      await response.text(),
    ]);
    expect(everything).not.toContain(IP);
  });

  it("AC-15: a failing pseudonymization is the generic error and stores nothing about the client", async () => {
    h.pseudonymize.mockImplementation(() => {
      throw new Error(`hash failed for ${IP}`);
    });

    const response = await h.send();

    await expectFailure(response.clone(), 500, "error");
    expect(h.interpret).not.toHaveBeenCalled();
    expect(h.memory.snapshot().clients).toEqual({});
    expect(h.measurement).toHaveBeenCalledExactlyOnceWith({
      result: "error",
      durationMs: expect.any(Number),
      clientId: null,
    });
    expect(JSON.stringify([h.logs, await response.text()])).not.toContain(IP);
  });
});
