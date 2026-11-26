import * as v from "valibot";
import type { Bounds } from "@/shared/actions";

const position = v.pipe(v.array(v.number()), v.minLength(2));
const ring = v.array(position);
// Only the outer ring of each polygon matters for the box.
const multiPolygon = v.object({
  type: v.literal("MultiPolygon"),
  coordinates: v.array(v.pipe(v.array(ring), v.minLength(1))),
});

function boxOf(outerRing: number[][]): Bounds | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [x, y] of outerRing) {
    if (x === undefined || y === undefined) continue;
    west = Math.min(west, x);
    east = Math.max(east, x);
    south = Math.min(south, y);
    north = Math.max(north, y);
  }
  return west < east && south < north
    ? [
        [west, south],
        [east, north],
      ]
    : null;
}

const area = ([[west, south], [east, north]]: Bounds) =>
  (east - west) * (north - south);

export type Center = [longitude: number, latitude: number];

const contains = (
  [[west, south], [east, north]]: Bounds,
  [longitude, latitude]: Center,
) =>
  longitude >= west &&
  longitude <= east &&
  latitude >= south &&
  latitude <= north;

/**
 * The box of the part of a multi-area place that holds its centre point (the largest part when
 * none does), or null when the place is not made of several areas. The box Nominatim reports
 * for such a place spans every part, so Tokyo reaches far-away islands, France its overseas
 * territories and Russia the whole globe. Offshore parts can be bigger than the mainland, which
 * is why the centre point decides first and the size only second.
 */
export function mainBodyBounds(
  geometry: unknown,
  center?: Center,
): Bounds | null {
  const parsed = v.safeParse(multiPolygon, geometry);
  if (!parsed.success) return null;

  const boxes: Bounds[] = [];
  for (const polygon of parsed.output.coordinates) {
    const box = polygon[0] && boxOf(polygon[0]);
    if (box) boxes.push(box);
  }
  const holdingCenter = center
    ? boxes.filter((box) => contains(box, center))
    : [];
  const candidates = holdingCenter.length > 0 ? holdingCenter : boxes;
  return candidates.reduce<Bounds | null>(
    (largest, box) =>
      largest === null || area(box) > area(largest) ? box : largest,
    null,
  );
}
