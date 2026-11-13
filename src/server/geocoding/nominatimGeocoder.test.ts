import { describe, expect, it, vi } from "vitest";
import { FakeClock } from "@/test/fakeClock";
import { NominatimGeocoder } from "./nominatimGeocoder";
import { GeocoderError } from "./types";

const signal = new AbortController().signal;

const BRNO = {
  category: "boundary",
  boundingbox: ["49.1096", "49.2946", "16.4283", "16.7283"],
};

const HOTEL = {
  category: "tourism",
  type: "hotel",
  boundingbox: ["48.8", "48.9", "2.2", "2.4"],
};

const TOWER = {
  category: "tourism",
  type: "attraction",
  boundingbox: ["48.85", "48.87", "2.28", "2.31"],
};

function setup(
  respond: (url: string) => Response | Promise<Response> = () =>
    Response.json([BRNO]),
) {
  const clock = new FakeClock();
  const slept: number[] = [];
  const fetchStub = vi.fn<typeof fetch>(async (input) =>
    respond(String(input)),
  );
  const geocoder = new NominatimGeocoder({
    baseUrl: "https://geo.example",
    contact: "ops@example.test",
    clock,
    sleep: async (milliseconds) => {
      slept.push(milliseconds);
      clock.advance(milliseconds);
    },
    fetch: fetchStub,
  });
  return { geocoder, fetchStub, slept, clock };
}

describe("NominatimGeocoder request", () => {
  it("AC-28: sends only the place name", async () => {
    const { geocoder, fetchStub } = setup();

    await geocoder.find("Plzeň", signal);

    const [url, init] = fetchStub.mock.calls[0] ?? [];
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      "https://geo.example/search",
    );
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      q: "Plzeň",
      limit: "10",
      format: "jsonv2",
      polygon_geojson: "1",
      polygon_threshold: "0.0001",
      addressdetails: "0",
    });
    expect(init?.signal).toBe(signal);
  });

  it("AC-14: identifies the application with a User-Agent that has the contact", async () => {
    const { geocoder, fetchStub } = setup();

    await geocoder.find("Brno", signal);

    const headers = new Headers(fetchStub.mock.calls[0]?.[1]?.headers);
    expect(headers.get("user-agent")).toBe("GeoGrind (ops@example.test)");
    expect([...headers.keys()]).toEqual(["user-agent"]);
  });
});

describe("NominatimGeocoder result", () => {
  it("AC-1: converts south/north/west/east strings to bounds", async () => {
    const { geocoder } = setup();

    expect(await geocoder.find("Brno", signal)).toEqual({
      bounds: [
        [16.4283, 49.1096],
        [16.7283, 49.2946],
      ],
    });
  });

  it("AC-1: a place made of several areas is shown by the area that holds its centre (Tokyo, not its islands)", async () => {
    const island = [
      [150, 20],
      [154, 20],
      [154, 28],
      [150, 28],
      [150, 20],
    ];
    const mainland = [
      [138.9, 35.5],
      [139.9, 35.5],
      [139.9, 35.9],
      [138.9, 35.9],
      [138.9, 35.5],
    ];
    const tokyo = {
      category: "boundary",
      lat: "35.7",
      lon: "139.4",
      boundingbox: ["20", "35.9", "138.9", "154"],
      geojson: { type: "MultiPolygon", coordinates: [[island], [mainland]] },
    };
    const { geocoder } = setup(() => Response.json([tokyo]));

    expect(await geocoder.find("Tokyo", signal)).toEqual({
      bounds: [
        [138.9, 35.5],
        [139.9, 35.9],
      ],
    });
  });

  it("falls back to the plain box when the outline is missing or odd", async () => {
    const odd = {
      ...BRNO,
      geojson: { type: "MultiPolygon", coordinates: "x" },
    };
    const { geocoder } = setup(() => Response.json([odd]));

    expect(await geocoder.find("Brno", signal)).toEqual({
      bounds: [
        [16.4283, 49.1096],
        [16.7283, 49.2946],
      ],
    });
  });

  it("AC-5: returns only a hotel when nothing better matched", async () => {
    const { geocoder } = setup(() => Response.json([HOTEL]));

    expect(await geocoder.find("Vienna", signal)).toEqual({
      bounds: [
        [2.2, 48.8],
        [2.4, 48.9],
      ],
    });
  });

  it("AC-5: information boards alone mean nothing was found", async () => {
    const board = {
      category: "tourism",
      type: "information",
      boundingbox: HOTEL.boundingbox,
    };
    const { geocoder } = setup(() => Response.json([board]));

    expect(await geocoder.find("Vienna", signal)).toBeNull();
  });

  it("AC-3: a landmark listed after a hotel wins for an ambiguous query", async () => {
    const { geocoder } = setup(() => Response.json([HOTEL, TOWER]));

    expect(await geocoder.find("Eiffel", signal)).toEqual({
      bounds: [
        [2.28, 48.85],
        [2.31, 48.87],
      ],
    });
  });

  it.each(["Hotel Eiffel Paris", "hotel Eiffel"])(
    "AC-4: %s returns the hotel, not the tower",
    async (query) => {
      const { geocoder } = setup(() => Response.json([TOWER, HOTEL]));

      expect(await geocoder.find(query, signal)).toEqual({
        bounds: [
          [2.2, 48.8],
          [2.4, 48.9],
        ],
      });
    },
  );

  it("AC-6: a town beats a hotel of the same name", async () => {
    const { geocoder } = setup(() => Response.json([HOTEL, BRNO]));

    expect(await geocoder.find("Vienna", signal)).toEqual({
      bounds: [
        [16.4283, 49.1096],
        [16.7283, 49.2946],
      ],
    });
  });

  it("AC-7: a landmark point gets a small extent that shows it, not a city", async () => {
    const colosseum = {
      category: "historic",
      type: "amphitheatre",
      lat: "41.89",
      lon: "12.49",
      boundingbox: ["41.89", "41.89", "12.49", "12.49"],
    };
    const { geocoder } = setup(() => Response.json([colosseum]));

    const found = await geocoder.find("Colosseum", signal);

    const [[west, south], [east, north]] = found?.bounds ?? [
      [0, 0],
      [0, 0],
    ];
    expect(east - west).toBeLessThanOrEqual(0.05);
    expect(north - south).toBeLessThanOrEqual(0.05);
    expect((west + east) / 2).toBeCloseTo(12.49);
  });

  it("AC-1: skips a non-place first match and uses the first real place", async () => {
    const board = {
      category: "information",
      boundingbox: ["1", "2", "3", "4"],
    };
    const { geocoder } = setup(() => Response.json([board, BRNO]));

    expect(await geocoder.find("Sumava", signal)).toEqual({
      bounds: [
        [16.4283, 49.1096],
        [16.7283, 49.2946],
      ],
    });
  });

  it("AC-16: returns null when nothing was found", async () => {
    const { geocoder } = setup(() => Response.json([]));

    expect(await geocoder.find("Neexistující Lhota", signal)).toBeNull();
  });

  it("gives a point-like result a minimum extent", async () => {
    const { geocoder } = setup(() =>
      Response.json([
        { category: "place", boundingbox: ["49.2", "49.2", "16.6", "16.6"] },
      ]),
    );

    const found = await geocoder.find("Lhota", signal);

    const [[west, south], [east, north]] = found?.bounds ?? [
      [0, 0],
      [0, 0],
    ];
    expect(east - west).toBeCloseTo(0.01);
    expect(north - south).toBeCloseTo(0.01);
    expect((west + east) / 2).toBeCloseTo(16.6);
  });

  it.each([
    ["an error status", () => new Response("rate limited", { status: 429 })],
    ["a server error", () => new Response("down", { status: 503 })],
    ["a non-array body", () => Response.json({ error: "x" })],
    [
      "a malformed box",
      () => Response.json([{ boundingbox: ["a", "b", "c", "d"] }]),
    ],
    ["a short box", () => Response.json([{ boundingbox: ["1", "2"] }])],
    ["a non-JSON body", () => new Response("<html>")],
  ])("AC-17: throws for %s", async (_name, respond) => {
    const { geocoder } = setup(respond);

    await expect(geocoder.find("Brno", signal)).rejects.toThrow();
  });

  it("does not leak the response body into the error", async () => {
    const { geocoder } = setup(
      () => new Response("secret-body", { status: 500 }),
    );

    const error = await geocoder.find("Brno", signal).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GeocoderError);
    expect(String(error)).not.toContain("secret-body");
  });
});

describe("NominatimGeocoder highlight", () => {
  const square = [
    [2.29, 48.85],
    [2.31, 48.85],
    [2.31, 48.87],
    [2.29, 48.87],
    [2.29, 48.85],
  ];
  const polygon = { type: "Polygon", coordinates: [square] };
  const withGeometry = <T extends object>(result: T, geojson: unknown) => ({
    ...result,
    geojson,
  });

  it("AC-1: a landmark answers with its polygon", async () => {
    const { geocoder } = setup(() =>
      Response.json([withGeometry(TOWER, polygon)]),
    );

    expect((await geocoder.find("Eiffel", signal))?.highlight).toEqual(polygon);
  });

  it("AC-2: a landmark point is passed on exactly as received", async () => {
    const point = { type: "Point", coordinates: [2.2945, 48.8584] };
    const { geocoder } = setup(() =>
      Response.json([withGeometry(TOWER, point)]),
    );

    expect((await geocoder.find("Eiffel", signal))?.highlight).toEqual(point);
  });

  it("AC-3: a river answers with its line", async () => {
    const line = { type: "LineString", coordinates: square };
    const river = withGeometry(
      { category: "waterway", type: "river", boundingbox: TOWER.boundingbox },
      line,
    );
    const { geocoder } = setup(() => Response.json([river]));

    expect((await geocoder.find("Vltava", signal))?.highlight).toEqual(line);
  });

  it("AC-4: a multi-polygon landmark keeps all its parts", async () => {
    const parts = { type: "MultiPolygon", coordinates: [[square], [square]] };
    const { geocoder } = setup(() =>
      Response.json([withGeometry(TOWER, parts)]),
    );

    expect((await geocoder.find("Eiffel", signal))?.highlight).toEqual(parts);
  });

  it("AC-5: a town answers without geometry, even though the server sent one", async () => {
    const { geocoder } = setup(() =>
      Response.json([withGeometry(BRNO, polygon)]),
    );

    const found = await geocoder.find("Brno", signal);

    expect(found).toEqual({
      bounds: [
        [16.4283, 49.1096],
        [16.7283, 49.2946],
      ],
    });
    expect(found).not.toHaveProperty("highlight");
  });

  it("AC-6: a hotel is highlighted", async () => {
    const { geocoder } = setup(() =>
      Response.json([withGeometry(HOTEL, polygon)]),
    );

    expect((await geocoder.find("Hotel Eiffel", signal))?.highlight).toEqual(
      polygon,
    );
  });

  it.each([
    ["is missing", TOWER],
    ["has an unexpected type", withGeometry(TOWER, { type: "Nope" })],
    ["is not geometry", withGeometry(TOWER, "x")],
  ])(
    "AC-9: a landmark whose geometry %s still zooms, without a highlight",
    async (_name, landmark) => {
      const { geocoder } = setup(() => Response.json([landmark]));

      const found = await geocoder.find("Eiffel", signal);

      expect(found?.bounds).toEqual([
        [2.28, 48.85],
        [2.31, 48.87],
      ]);
      expect(found).not.toHaveProperty("highlight");
    },
  );

  it("AC-10: very detailed geometry is left out and the zoom still works", async () => {
    const detailed = Array.from({ length: 60_000 }, (_, index) => [
      2 + index / 1_000_000,
      48 + (index % 2) / 1_000,
    ]);
    const line = { type: "LineString", coordinates: detailed };
    const { geocoder } = setup(() =>
      Response.json([withGeometry(TOWER, line)]),
    );

    const found = await geocoder.find("Eiffel", signal);

    expect(found?.highlight).toBeUndefined();
    expect(found?.bounds).toBeDefined();
  });

  it("AC-12: a repeated command is served from the cache with its highlight", async () => {
    const { geocoder, fetchStub } = setup(() =>
      Response.json([withGeometry(TOWER, polygon)]),
    );

    await geocoder.find("Eiffel", signal);
    const again = await geocoder.find("Eiffel", signal);

    expect(fetchStub).toHaveBeenCalledOnce();
    expect(again?.highlight).toEqual(polygon);
  });

  it("AC-11: the view of a multi-area place is the same with the finer outline tolerance", async () => {
    const mainland = [
      [138.9, 35.5],
      [139.9, 35.5],
      [139.9, 35.9],
      [138.9, 35.9],
      [138.9, 35.5],
    ];
    const island = [
      [150, 20],
      [154, 20],
      [154, 28],
      [150, 28],
      [150, 20],
    ];
    const tokyo = {
      category: "boundary",
      lat: "35.7",
      lon: "139.4",
      boundingbox: ["20", "35.9", "138.9", "154"],
      geojson: { type: "MultiPolygon", coordinates: [[island], [mainland]] },
    };
    const { geocoder } = setup(() => Response.json([tokyo]));

    const found = await geocoder.find("Tokyo", signal);

    expect(found?.bounds).toEqual([
      [138.9, 35.5],
      [139.9, 35.9],
    ]);
    expect(found).not.toHaveProperty("highlight");
  });
});

describe("NominatimGeocoder politeness", () => {
  it("serialises requests at least one second apart", async () => {
    const { geocoder, slept } = setup();

    await Promise.all([
      geocoder.find("Brno", signal),
      geocoder.find("Plzeň", signal),
      geocoder.find("Ostrava", signal),
    ]);

    expect(slept).toEqual([1000, 1000]);
  });

  it("does not wait when enough time has passed", async () => {
    const { geocoder, slept, clock } = setup();

    await geocoder.find("Brno", signal);
    clock.advance(1500);
    await geocoder.find("Plzeň", signal);

    expect(slept).toEqual([]);
  });

  it("caches answers, also case-insensitively, and found-nothing results", async () => {
    const { geocoder, fetchStub } = setup((url) =>
      Response.json(url.includes("Nikde") ? [] : [BRNO]),
    );

    await geocoder.find("Brno", signal);
    await geocoder.find("brno", signal);
    await geocoder.find("Nikde", signal);
    await geocoder.find("Nikde", signal);

    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    let fail = true;
    const { geocoder, fetchStub } = setup(() =>
      fail ? new Response("", { status: 503 }) : Response.json([BRNO]),
    );

    await expect(geocoder.find("Brno", signal)).rejects.toThrow();
    fail = false;
    await geocoder.find("Brno", signal);

    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("stops waiting for its turn when the request is aborted", async () => {
    const { geocoder, fetchStub } = setup();
    const controller = new AbortController();
    controller.abort(new Error("budget"));

    await expect(geocoder.find("Brno", controller.signal)).rejects.toThrow(
      "budget",
    );
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
