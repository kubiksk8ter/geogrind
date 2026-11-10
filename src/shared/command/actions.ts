import * as v from "valibot";
import { isCleanText } from "./text";

export const MAX_PLACE_LENGTH = 100;

/** Longitude/latitude box: [[west, south], [east, north]]. */
export type Bounds = [
  [west: number, south: number],
  [east: number, north: number],
];

const longitude = v.pipe(v.number(), v.minValue(-180), v.maxValue(180));
const latitude = v.pipe(v.number(), v.minValue(-90), v.maxValue(90));

export const boundsSchema = v.pipe(
  v.strictTuple([
    v.strictTuple([longitude, latitude]),
    v.strictTuple([longitude, latitude]),
  ]),
  v.check(([[west, south], [east, north]]) => west < east && south < north),
);

const placeSchema = v.pipe(
  v.string(),
  v.check((place) => isCleanText(place, MAX_PLACE_LENGTH)),
);

/** Subset of JSON Schema that Groq's strict mode accepts. */
export type StrictJsonSchema = Readonly<Record<string, unknown>>;

export interface ActionDefinition {
  name: string;
  /** Tells the model when to choose this action and what its fields hold. */
  description: string;
  /** What the model may return for this action (checked at runtime after Groq's own check). */
  output: v.GenericSchema;
  /** The same shape as a strict JSON schema for Groq. */
  jsonSchema: StrictJsonSchema;
  /** What the server answers to the browser when the action succeeded. */
  result: v.GenericSchema;
}

const zoomToPlace = {
  name: "zoom_to_place",
  description:
    "The user wants the map to show or zoom to one named place (town, village, region, mountain, street, ...). Field place: only the place name, without verbs or other words.",
  output: v.strictObject({
    action: v.literal("zoom_to_place"),
    place: placeSchema,
  }),
  jsonSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["zoom_to_place"] },
      place: { type: "string" },
    },
    required: ["action", "place"],
    additionalProperties: false,
  },
  result: v.strictObject({
    action: v.literal("zoom_to_place"),
    bounds: boundsSchema,
  }),
} as const satisfies ActionDefinition;

/**
 * The closed action list. A further action is added here (and handled by the server's
 * exhaustive handler table); validation, cooldown and limits do not change.
 */
export const ACTION_LIST = [zoomToPlace] as const;

export type ActionName = (typeof ACTION_LIST)[number]["name"];

const unsupported = {
  output: v.strictObject({ action: v.literal("unsupported") }),
  jsonSchema: {
    type: "object",
    properties: { action: { type: "string", enum: ["unsupported"] } },
    required: ["action"],
    additionalProperties: false,
  },
} as const;

export const modelOutputSchema = v.union([
  ...ACTION_LIST.map((action) => action.output),
  unsupported.output,
]);
export type ModelOutput = v.InferOutput<typeof modelOutputSchema>;

/** Groq wants an object at the root, so the choice of action sits one level below. */
export const MODEL_OUTPUT_JSON_SCHEMA: StrictJsonSchema = {
  type: "object",
  properties: {
    output: {
      anyOf: [
        ...ACTION_LIST.map((action) => action.jsonSchema),
        unsupported.jsonSchema,
      ],
    },
  },
  required: ["output"],
  additionalProperties: false,
};

export const modelResponseSchema = v.strictObject({
  output: modelOutputSchema,
});

export const commandResultSchema = v.union(
  ACTION_LIST.map((action) => action.result),
);
export type CommandResult = v.InferOutput<typeof commandResultSchema>;
