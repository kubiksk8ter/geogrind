import "server-only";
import * as v from "valibot";
import type { Bounds } from "@/shared/command/actions";
import type { Highlight } from "@/shared/command/highlightSchema";
import type { Clock } from "../state/types";
import {
  DEFAULT_MIN_SPAN_DEGREES,
  ensureMinimumSize,
  LANDMARK_MIN_SPAN_DEGREES,
} from "./bounds";
import { toMapGeometry } from "./geometryForMap";
import { type Center, mainBodyBounds } from "./mainBody";
import { isHighlighted, isLandmark, pickBest } from "./ranking";
import { RequestSpacer } from "./requestSpacer";
import { type Geocoder, GeocoderError } from "./types";

const MIN_REQUEST_INTERVAL_MS = 1_000;
const CACHE_SIZE = 200;
// The best match may be a hotel or a board, so several candidates are requested and ranked.
const CANDIDATE_COUNT = "10";
// Simplifies the returned outlines. About 10 m: fine enough to draw a building or a bridge, and
// still a good basis for finding the largest part of a place.
const POLYGON_TOLERANCE_DEGREES = "0.0001";

// Nominatim returns the box as ["south", "north", "west", "east"] strings.
const coordinate = v.pipe(v.string(), v.transform(Number), v.finite());
const resultsSchema = v.array(
  v.object({
    category: v.string(),
    type: v.optional(v.string()),
    lat: v.optional(coordinate),
    lon: v.optional(coordinate),
    // Checked separately; anything unexpected here only means "use the plain box".
    geojson: v.optional(v.unknown()),
    boundingbox: v.strictTuple([
      coordinate,
      coordinate,
      coordinate,
      coordinate,
    ]),
  }),
);

export interface NominatimOptions {
  baseUrl: string;
  /** E-mail or URL that identifies the operator in the User-Agent. */
  contact: string | undefined;
  clock: Clock;
  sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  fetch?: typeof fetch;
}

type Found = { bounds: Bounds; highlight?: Highlight } | null;

export class NominatimGeocoder implements Geocoder {
  private readonly spacer: RequestSpacer;
  // Map keeps insertion order, so the first key is the least recently used one.
  private readonly cache = new Map<string, Found>();

  constructor(private readonly options: NominatimOptions) {
    this.spacer = new RequestSpacer(
      MIN_REQUEST_INTERVAL_MS,
      options.clock,
      options.sleep,
    );
  }

  async find(place: string, signal: AbortSignal): Promise<Found> {
    const key = place.toLocaleLowerCase();
    const cached = this.remembered(key);
    if (cached !== undefined) return cached;

    const found = await this.spacer.run(
      () => this.search(place, signal),
      signal,
    );
    this.remember(key, found);
    return found;
  }

  private remembered(key: string): Found | undefined {
    const cached = this.cache.get(key);
    if (cached === undefined) return undefined;
    this.cache.delete(key);
    this.cache.set(key, cached);
    return cached;
  }

  private remember(key: string, found: Found): void {
    this.cache.delete(key);
    this.cache.set(key, found);
    const oldest = this.cache.keys().next();
    if (this.cache.size > CACHE_SIZE && !oldest.done) {
      this.cache.delete(oldest.value);
    }
  }

  private async search(place: string, signal: AbortSignal): Promise<Found> {
    const { baseUrl, contact } = this.options;
    const query = new URLSearchParams({
      q: place,
      limit: CANDIDATE_COUNT,
      format: "jsonv2",
      polygon_geojson: "1",
      polygon_threshold: POLYGON_TOLERANCE_DEGREES,
      addressdetails: "0",
    });
    const send = this.options.fetch ?? fetch;
    const response = await send(`${baseUrl}/search?${query}`, {
      signal,
      headers: { "User-Agent": contact ? `GeoGrind (${contact})` : "GeoGrind" },
    });
    if (!response.ok) {
      throw new GeocoderError(`Geocoder answered ${response.status}`);
    }

    const results = v.safeParse(resultsSchema, await response.json());
    if (!results.success) {
      throw new GeocoderError("Geocoder answer has an unexpected shape");
    }
    const first = pickBest(place, results.output);
    if (!first) return null;

    const [south, north, west, east] = first.boundingbox;
    const center: Center | undefined =
      first.lon !== undefined && first.lat !== undefined
        ? [first.lon, first.lat]
        : undefined;
    const bounds = mainBodyBounds(first.geojson, center) ?? [
      [west, south],
      [east, north],
    ];
    const minSpan = isLandmark(first)
      ? LANDMARK_MIN_SPAN_DEGREES
      : DEFAULT_MIN_SPAN_DEGREES;
    const highlight = isHighlighted(first)
      ? toMapGeometry(first.geojson)
      : undefined;
    return {
      bounds: ensureMinimumSize(bounds, minSpan),
      ...(highlight && { highlight }),
    };
  }
}
