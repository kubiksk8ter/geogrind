import * as v from "valibot";
import { type Highlight, highlightSchema } from "@/shared/highlightSchema";

/**
 * Prepares the geometry that Nominatim returns for a result so that it can be sent to the
 * browser and drawn on the map as a highlight. The geometry is checked against the schema the
 * browser expects, and one with too many positions is left out: the zoom then works without a
 * highlight instead of sending a huge answer.
 */

/** What may be sent to the browser; roughly 100 kB of JSON. */
export const MAX_HIGHLIGHT_POSITIONS = 5_000;

function countPositions(geometry: Highlight): number {
  switch (geometry.type) {
    case "Point":
      return 1;
    case "LineString":
      return geometry.coordinates.length;
    case "MultiLineString":
    case "Polygon":
      return geometry.coordinates.reduce((sum, part) => sum + part.length, 0);
    case "MultiPolygon":
      return geometry.coordinates.reduce(
        (sum, polygon) =>
          sum + polygon.reduce((inner, ring) => inner + ring.length, 0),
        0,
      );
  }
}

/**
 * The geometry to send to the browser, or undefined when it is missing, invalid, of another
 * type or larger than MAX_HIGHLIGHT_POSITIONS. Coordinates are passed on unchanged.
 */
export function toMapGeometry(geojson: unknown): Highlight | undefined {
  const parsed = v.safeParse(highlightSchema, geojson);
  if (!parsed.success) return undefined;
  return countPositions(parsed.output) <= MAX_HIGHLIGHT_POSITIONS
    ? parsed.output
    : undefined;
}
