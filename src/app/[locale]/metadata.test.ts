import { describe, expect, it } from "vitest";
import { generateIntroMetadata } from "./metadata";

describe("generateIntroMetadata", () => {
  it("AC-4: title contains GeoGrind", () => {
    expect(generateIntroMetadata().title).toContain("GeoGrind");
  });
});
