import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  ACTION_LIST,
  commandResultSchema,
  MAX_PLACE_LENGTH,
  MODEL_OUTPUT_JSON_SCHEMA,
  modelResponseSchema,
} from "./actions";

const accepts = (output: unknown) =>
  v.safeParse(modelResponseSchema, { output }).success;

describe("model output schema", () => {
  it("accepts the zoom action with a place", () => {
    expect(accepts({ action: "zoom_to_place", place: "Brno" })).toBe(true);
  });

  it("accepts the built-in unsupported action", () => {
    expect(accepts({ action: "unsupported" })).toBe(true);
  });

  it.each([
    ["unknown action", { action: "show_layer", place: "Brno" }],
    ["extra field", { action: "zoom_to_place", place: "Brno", zoom: 99 }],
    ["extra field on unsupported", { action: "unsupported", reason: "joke" }],
    ["missing place", { action: "zoom_to_place" }],
    ["numeric place", { action: "zoom_to_place", place: 5 }],
    ["coordinates instead of a place", { action: "zoom_to_place", lat: 0 }],
    ["empty place", { action: "zoom_to_place", place: "" }],
    [
      "place over the limit",
      { action: "zoom_to_place", place: "a".repeat(MAX_PLACE_LENGTH + 1) },
    ],
    ["place with a newline", { action: "zoom_to_place", place: "Brno\nok" }],
    ["free text", "Sure, here you go"],
    ["null", null],
  ])("AC-10: rejects %s", (_name, output) => {
    expect(accepts(output)).toBe(false);
  });

  it("AC-10: rejects a response with extra top-level fields", () => {
    expect(
      v.safeParse(modelResponseSchema, {
        output: { action: "unsupported" },
        note: "hi",
      }).success,
    ).toBe(false);
  });
});

describe("command result schema", () => {
  const bounds = [
    [16.4, 49.1],
    [16.7, 49.3],
  ];
  const parse = (badBounds: unknown) =>
    v.safeParse(commandResultSchema, {
      action: "zoom_to_place",
      bounds: badBounds,
    }).success;

  it("accepts valid bounds", () => {
    expect(parse(bounds)).toBe(true);
  });

  it.each([
    ["swapped corners", [bounds[1], bounds[0]]],
    [
      "non-numeric",
      [
        ["a", 1],
        [2, 3],
      ],
    ],
    [
      "longitude out of range",
      [
        [0, 0],
        [181, 1],
      ],
    ],
    [
      "NaN",
      [
        [Number.NaN, 0],
        [1, 1],
      ],
    ],
    ["a third corner", [...bounds, [1, 1]]],
  ])("AC-10: rejects %s", (_name, badBounds) => {
    expect(parse(badBounds)).toBe(false);
  });
});

// Groq's strict mode: every property required, no additional properties, supported keywords only.
const ALLOWED_KEYWORDS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "enum",
  "anyOf",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function strictViolations(schema: unknown, path = "$"): string[] {
  if (!isRecord(schema)) return [];
  const problems = Object.keys(schema)
    .filter((key) => !ALLOWED_KEYWORDS.has(key))
    .map((key) => `${path}: keyword ${key}`);

  const { properties, required, additionalProperties, anyOf } = schema;
  if (isRecord(properties)) {
    const names = Object.keys(properties).sort();
    if (additionalProperties !== false)
      problems.push(`${path}: additionalProperties must be false`);
    if (
      !Array.isArray(required) ||
      [...required].sort().join() !== names.join()
    )
      problems.push(`${path}: all properties must be required`);
    for (const [name, child] of Object.entries(properties))
      problems.push(...strictViolations(child, `${path}.${name}`));
  }
  if (Array.isArray(anyOf))
    anyOf.forEach((option, index) => {
      problems.push(...strictViolations(option, `${path}.anyOf[${index}]`));
    });
  return problems;
}

describe("Groq JSON schema", () => {
  it("NFR-7: follows the strict-mode rules", () => {
    expect(strictViolations(MODEL_OUTPUT_JSON_SCHEMA)).toEqual([]);
  });

  it("has an object at the root", () => {
    expect(MODEL_OUTPUT_JSON_SCHEMA.type).toBe("object");
  });

  it("AC-30: offers every registry action plus unsupported", () => {
    const output = isRecord(MODEL_OUTPUT_JSON_SCHEMA.properties)
      ? MODEL_OUTPUT_JSON_SCHEMA.properties.output
      : undefined;
    const options = isRecord(output) ? output.anyOf : undefined;

    expect(options).toHaveLength(ACTION_LIST.length + 1);
  });

  it("the checker notices a rule violation", () => {
    expect(
      strictViolations({
        type: "object",
        properties: { a: { type: "string", minLength: 1 } },
        required: [],
      }),
    ).toHaveLength(3);
  });
});
