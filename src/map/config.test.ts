import { describe, expect, it } from "vitest";
import { MAP_CONFIG } from "./config";

describe("MAP_CONFIG", () => {
  const [[west, south], [east, north]] = MAP_CONFIG.czechBounds;

  it("has a valid bounding box", () => {
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
  });

  it("AC-2: bounds cover the Czech Republic extremes", () => {
    expect(west).toBeLessThanOrEqual(12.1);
    expect(east).toBeGreaterThanOrEqual(18.86);
    expect(south).toBeLessThanOrEqual(48.56);
    expect(north).toBeGreaterThanOrEqual(51.05);
  });

  it("uses an https style URL", () => {
    expect(MAP_CONFIG.styleUrl).toMatch(/^https:\/\//);
  });
});
