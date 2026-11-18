import { describe, expect, it } from "vitest";
import { pieSlices, sparklinePath } from "./chartGeometry";

const CIRCLE = { cx: 50, cy: 50, r: 50 };

/** The start and end points on the circle of a slice path "M c L start A ... end Z". */
function arcEnds(d: string) {
  const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const [, , startX, startY, , , , , , endX, endY] = numbers;
  return { start: [startX, startY], end: [endX, endY] };
}

describe("pieSlices", () => {
  it("AC-2: 6/0/2/1/0/0/1 gives 60, 20, 10 and 10 % in order, clockwise from the top", () => {
    const slices = pieSlices(
      [
        { key: "success", count: 6 },
        { key: "unsupported", count: 0 },
        { key: "not_found", count: 2 },
        { key: "wait", count: 1 },
        { key: "too_many_requests", count: 0 },
        { key: "ai_resting", count: 0 },
        { key: "error", count: 1 },
      ],
      CIRCLE,
    );

    expect(slices.map(({ key, fraction }) => [key, fraction])).toEqual([
      ["success", 0.6],
      ["not_found", 0.2],
      ["wait", 0.1],
      ["error", 0.1],
    ]);
    // Each slice starts where the one before ended, the first and the last at the top.
    const ends = slices.map(({ d }) => arcEnds(d));
    expect(ends[0]?.start).toEqual([50, 0]);
    for (let index = 1; index < ends.length; index++) {
      expect(ends[index]?.start).toEqual(ends[index - 1]?.end);
    }
    expect(ends.at(-1)?.end).toEqual([50, 0]);
  });

  it("uses the large arc only for a slice over half of the circle", () => {
    const [big, small] = pieSlices(
      [
        { key: "a", count: 3 },
        { key: "b", count: 1 },
      ],
      CIRCLE,
    );

    expect(big?.d).toContain("A 50 50 0 1 1");
    expect(small?.d).toContain("A 50 50 0 0 1");
  });

  it("AC-3: a single result at 100 % is a full circle, not an empty arc", () => {
    const slices = pieSlices(
      [
        { key: "success", count: 4 },
        { key: "error", count: 0 },
      ],
      CIRCLE,
    );

    expect(slices).toEqual([
      {
        key: "success",
        fraction: 1,
        d: "M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z",
      },
    ]);
  });

  it("AC-3: a total of 0 gives no slices (no stand-in circle)", () => {
    expect(
      pieSlices(
        [
          { key: "success", count: 0 },
          { key: "error", count: 0 },
        ],
        CIRCLE,
      ),
    ).toEqual([]);
  });
});

describe("sparklinePath", () => {
  const BOX = { width: 110, height: 20, inset: 0 };

  it("FR-5: scales from 0 at the bottom to the largest value at the top", () => {
    const { d, dots } = sparklinePath([0, 50, 100], {
      width: 100,
      height: 20,
      inset: 0,
    });

    expect(d).toBe("M 0 20 L 50 10 L 100 0");
    expect(dots).toEqual([]);
  });

  it("keeps the inset free at the edges", () => {
    const { d } = sparklinePath([0, 100], { width: 100, height: 20, inset: 2 });

    expect(d).toBe("M 2 18 L 98 2");
  });

  it("stretches between real values are solid, those touching an empty bucket are dotted", () => {
    const { d, dotted, dots } = sparklinePath(
      [null, null, 10, 20, null, null, null, null, null, null, null, null],
      BOX,
    );

    expect(d).toBe("M 20 10 L 30 0");
    expect(dotted).toBe(
      "M 0 20 L 10 20 L 20 10 M 30 0 L 40 20 L 50 20 L 60 20 L 70 20 L 80 20 L 90 20 L 100 20 L 110 20",
    );
    expect(dots).toEqual([]);
  });

  it("a single value between empty buckets is a dotted peak, not a floating dot", () => {
    const { d, dotted, dots } = sparklinePath([null, null, 300, null], {
      width: 30,
      height: 10,
      inset: 0,
    });

    expect(d).toBe("");
    expect(dotted).toBe("M 0 10 L 10 10 L 20 0 L 30 10");
    expect(dots).toEqual([]);
  });

  it("a series of one bucket is a dot", () => {
    const { d, dotted, dots } = sparklinePath([5], {
      width: 30,
      height: 10,
      inset: 0,
    });

    expect(d).toBe("");
    expect(dotted).toBe("");
    expect(dots).toEqual([{ x: 15, y: 0 }]);
  });

  it("all zero durations lie on the bottom line", () => {
    const { d } = sparklinePath([0, 0], { width: 10, height: 10, inset: 0 });

    expect(d).toBe("M 0 10 L 10 10");
  });

  it("nothing to draw for an empty series", () => {
    expect(sparklinePath([null, null], BOX)).toEqual({
      d: "",
      dotted: "",
      dots: [],
    });
  });
});
