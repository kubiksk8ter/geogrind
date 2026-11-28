// @vitest-environment node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodePng } from "@/test/decodePng";

// The colour of the active side panel tab (Tailwind neutral-900).
const BACKGROUND = "#171717";

const readProjectFile = (path: string) => readFile(join(process.cwd(), path));

const readPng = async (path: string) => decodePng(await readProjectFile(path));

function hex([red, green, blue]: readonly number[]) {
  return `#${[red, green, blue].map((value) => (value ?? 0).toString(16).padStart(2, "0")).join("")}`;
}

describe("master artwork (icon.svg)", () => {
  it("AC-3: is a self-contained SVG that draws the G as a shape, not with a font", async () => {
    const svg = String(await readProjectFile("src/app/icon.svg"));

    expect(svg).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).not.toMatch(/<text|font|<image|href=|url\(/i);
  });

  it("FR-1: is a white G on the background colour of the active tab", async () => {
    const svg = String(await readProjectFile("src/app/icon.svg"));

    expect(svg).toContain(
      `<rect width="64" height="64" rx="14" fill="${BACKGROUND}"/>`,
    );
    expect(svg).toContain('stroke="#fff"');
  });
});

describe("raster copies", () => {
  it("FR-6, AC-1: favicon.ico is an ICO holding a 32 px image", async () => {
    const ico = await readProjectFile("src/app/favicon.ico");

    expect([ico[6], ico[7]]).toEqual([32, 32]);
    const image = decodePng(ico.subarray(22));
    expect([image.width, image.height]).toEqual([32, 32]);
  });

  it("AC-5: the 180 px apple touch icon is opaque everywhere", async () => {
    const image = await readPng("src/app/apple-icon.png");

    expect([image.width, image.height]).toEqual([180, 180]);
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        expect(image.pixel(x, y)[3]).toBe(255);
      }
    }
    expect(hex(image.pixel(0, 0))).toBe(BACKGROUND);
  });

  it("AC-7: the whole G lies inside the maskable safe zone (circle of 40 % radius)", async () => {
    const image = await readPng("public/icons/geogrind-icon-maskable-512.png");
    const centre = image.width / 2;
    let letter = 0;
    let outside = 0;

    // Pixels of the white "G", anti-aliased edges included.
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const [red, , , alpha] = image.pixel(x, y);
        if (alpha === 0 || red <= 64) continue;
        letter++;
        const distance = Math.hypot(x + 0.5 - centre, y + 0.5 - centre);
        if (distance > image.width * 0.4) outside++;
      }
    }

    expect(letter).toBeGreaterThan(0);
    expect(outside).toBe(0);
  });
});
