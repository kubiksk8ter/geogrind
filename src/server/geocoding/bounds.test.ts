import { describe, expect, it } from "vitest";
import { ensureMinimumSize } from "./bounds";

describe("ensureMinimumSize", () => {
  it("leaves a big enough box alone", () => {
    const box: ReturnType<typeof ensureMinimumSize> = [
      [16, 49],
      [17, 50],
    ];

    expect(ensureMinimumSize(box)).toEqual(box);
  });

  it("widens only the flat axis", () => {
    const [[west, south], [east, north]] = ensureMinimumSize([
      [16, 49],
      [16, 50],
    ]);

    expect(east - west).toBeCloseTo(0.01);
    expect([south, north]).toEqual([49, 50]);
  });
});
