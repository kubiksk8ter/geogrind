// @vitest-environment node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodePng } from "@/test/decodePng";
import manifest from "./manifest";

describe("web manifest", () => {
  it("FR-4, AC-6: names the app GeoGrind and opens it standalone at the start address", () => {
    const result = manifest();

    expect(result.name).toBe("GeoGrind");
    expect(result.short_name).toBe("GeoGrind");
    expect(result.display).toBe("standalone");
    // FR-5: "/" chooses the language like any visit to it.
    expect(result.start_url).toBe("/");
    expect(result.background_color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("NFR-2: holds no text besides the product name", () => {
    const result = manifest();

    expect(result.description).toBeUndefined();
    expect(result.shortcuts).toBeUndefined();
  });

  it("FR-4: lists 192 and 512 px icons and a maskable one", () => {
    const icons = manifest().icons ?? [];

    expect(icons.map(({ sizes, purpose }) => `${sizes} ${purpose}`)).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
    ]);
  });

  it("AC-6: every manifest icon is a PNG file of its declared size", async () => {
    for (const icon of manifest().icons ?? []) {
      const file = await readFile(join(process.cwd(), "public", icon.src));
      const image = decodePng(file);

      expect(icon.type).toBe("image/png");
      expect(`${image.width}x${image.height}`).toBe(icon.sizes);
    }
  });
});
