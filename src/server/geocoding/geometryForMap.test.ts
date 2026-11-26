import { describe, expect, it } from "vitest";
import { MAX_HIGHLIGHT_POSITIONS, toMapGeometry } from "./geometryForMap";

const square = [
  [16.6, 49.2],
  [16.7, 49.2],
  [16.7, 49.3],
  [16.6, 49.3],
  [16.6, 49.2],
];

// A closed ring with the given number of positions.
function ring(count: number) {
  const positions = Array.from({ length: count - 1 }, (_, index) => [
    16 + index / count,
    49 + (index % 2) / 100,
  ]);
  return [...positions, positions[0]];
}

describe("toMapGeometry", () => {
  it("AC-2: passes a point on with exactly the received coordinates", () => {
    const point = { type: "Point", coordinates: [14.4132, 50.0865] };

    expect(toMapGeometry(point)).toEqual(point);
  });

  it.each([
    ["AC-1: a polygon", { type: "Polygon", coordinates: [square] }],
    ["AC-3: a line", { type: "LineString", coordinates: square }],
    [
      "AC-3: several lines",
      { type: "MultiLineString", coordinates: [square, square] },
    ],
    [
      "AC-4: a multi-polygon",
      { type: "MultiPolygon", coordinates: [[square], [square]] },
    ],
  ])("%s is passed on unchanged", (_name, geometry) => {
    expect(toMapGeometry(geometry)).toEqual(geometry);
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["a text", "Polygon"],
    ["an unexpected type", { type: "GeometryCollection", geometries: [] }],
    ["a MultiPoint", { type: "MultiPoint", coordinates: [[1, 2]] }],
    [
      "a point with a text coordinate",
      { type: "Point", coordinates: ["a", 2] },
    ],
    ["a point out of range", { type: "Point", coordinates: [200, 2] }],
    ["a one-position line", { type: "LineString", coordinates: [[1, 2]] }],
    [
      "an unclosed ring",
      { type: "Polygon", coordinates: [square.slice(0, 3)] },
    ],
    ["a polygon without rings", { type: "Polygon", coordinates: [] }],
  ])("AC-9: %s gives no highlight", (_name, geometry) => {
    expect(toMapGeometry(geometry)).toBeUndefined();
  });

  it("AC-10: keeps a geometry that has exactly the largest allowed size", () => {
    const geometry = {
      type: "Polygon",
      coordinates: [ring(MAX_HIGHLIGHT_POSITIONS)],
    };

    expect(toMapGeometry(geometry)).toEqual(geometry);
  });

  it.each([
    [
      "an area",
      { type: "Polygon", coordinates: [ring(MAX_HIGHLIGHT_POSITIONS + 1)] },
    ],
    [
      "a line",
      { type: "LineString", coordinates: ring(MAX_HIGHLIGHT_POSITIONS + 1) },
    ],
    [
      "several areas that are large together",
      {
        type: "MultiPolygon",
        coordinates: [
          [ring(MAX_HIGHLIGHT_POSITIONS)],
          [ring(MAX_HIGHLIGHT_POSITIONS)],
        ],
      },
    ],
  ])("AC-10: %s over the size limit gives no highlight", (_name, geometry) => {
    expect(toMapGeometry(geometry)).toBeUndefined();
  });
});
