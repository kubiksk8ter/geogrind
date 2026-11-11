import * as v from "valibot";

const longitude = v.pipe(v.number(), v.minValue(-180), v.maxValue(180));
const latitude = v.pipe(v.number(), v.minValue(-90), v.maxValue(90));

const position = v.strictTuple([longitude, latitude]);
const line = v.pipe(v.array(position), v.minLength(2));
const ring = v.pipe(v.array(position), v.minLength(4));
const polygon = v.pipe(v.array(ring), v.minLength(1));

/** The found object as GeoJSON geometry, drawn on the map as received from the geocoder. */
export const highlightSchema = v.variant("type", [
  v.strictObject({ type: v.literal("Point"), coordinates: position }),
  v.strictObject({ type: v.literal("LineString"), coordinates: line }),
  v.strictObject({
    type: v.literal("MultiLineString"),
    coordinates: v.pipe(v.array(line), v.minLength(1)),
  }),
  v.strictObject({ type: v.literal("Polygon"), coordinates: polygon }),
  v.strictObject({
    type: v.literal("MultiPolygon"),
    coordinates: v.pipe(v.array(polygon), v.minLength(1)),
  }),
]);
export type Highlight = v.InferOutput<typeof highlightSchema>;
