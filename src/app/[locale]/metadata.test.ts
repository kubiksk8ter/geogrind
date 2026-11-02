import { describe, expect, it } from "vitest";
import { generatePageMetadata } from "./metadata";

describe("generatePageMetadata", () => {
  it("AC-7: title contains GeoGrind", () => {
    expect(generatePageMetadata().title).toContain("GeoGrind");
  });
});
