import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_TIMEOUT_MS, sendCommand } from "./commandClient";

const REQUEST = { text: "Zoom to Brno", locale: "en" } as const;
const GENERIC_ERROR = { ok: false, error: { code: "error" } };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubFetch(respond: () => Response | Promise<Response>) {
  const fetchStub = vi.fn<typeof fetch>(async () => respond());
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

describe("sendCommand", () => {
  it("posts the request as JSON to the command endpoint", async () => {
    const fetchStub = stubFetch(() =>
      Response.json({ ok: false, error: { code: "unsupported" } }),
    );

    await sendCommand(REQUEST);

    const [url, init] = fetchStub.mock.calls[0] ?? [];
    expect(url).toBe("/api/command");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(JSON.parse(String(init?.body))).toEqual(REQUEST);
  });

  it("returns a valid answer, also for HTTP error statuses", async () => {
    stubFetch(() =>
      Response.json(
        { ok: false, error: { code: "wait", retryAfterSeconds: 3 } },
        { status: 429 },
      ),
    );

    expect(await sendCommand(REQUEST)).toEqual({
      ok: false,
      error: { code: "wait", retryAfterSeconds: 3 },
    });
  });

  it("returns a success", async () => {
    const success = {
      ok: true,
      result: {
        action: "zoom_to_place",
        bounds: [
          [16, 49],
          [17, 50],
        ],
      },
      cooldownSeconds: 10,
    };
    stubFetch(() => Response.json(success));

    expect(await sendCommand(REQUEST)).toEqual(success);
  });

  it.each([
    ["an unexpected shape", () => Response.json({ ok: true })],
    [
      "bounds outside the valid range",
      () =>
        Response.json({
          ok: true,
          result: {
            action: "zoom_to_place",
            bounds: [
              [0, 0],
              [999, 1],
            ],
          },
          cooldownSeconds: 10,
        }),
    ],
    [
      "a non-JSON body",
      () => new Response("<html>Bad gateway</html>", { status: 502 }),
    ],
    [
      "a network error",
      () => {
        throw new TypeError("Failed to fetch");
      },
    ],
  ])("AC-17: turns %s into the generic error", async (_name, respond) => {
    stubFetch(respond);

    expect(await sendCommand(REQUEST)).toEqual(GENERIC_ERROR);
  });

  it("AC-3: gives up with the generic error when there is no answer in time", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason),
            );
          }),
      ),
    );

    const pending = sendCommand(REQUEST);
    await vi.advanceTimersByTimeAsync(COMMAND_TIMEOUT_MS);

    expect(await pending).toEqual(GENERIC_ERROR);
  });
});
