import { describe, expect, it } from "vitest";
import {
  isCleanCommandText,
  MAX_COMMAND_LENGTH,
  normalizeCommandText,
} from "./text";

// Invisible characters are spelled as code points so they stay visible in the source.
const chars = (...codePoints: number[]) => String.fromCodePoint(...codePoints);
const NBSP = chars(0xa0);
const ZERO_WIDTH_SPACE = chars(0x200b);
const ZERO_WIDTH_JOINER = chars(0x200d);
const BYTE_ORDER_MARK = chars(0xfeff);
const BIDI_OVERRIDE = chars(0x202e);
const BIDI_POP = chars(0x202c);
const BIDI_ISOLATE = chars(0x2066, 0x2069);
const CONTROLS = chars(0x00, 0x1b, 0x7f);
const SEPARATORS = chars(0x2028, 0x2029);
const PRIVATE_USE = chars(0xe000);
const UNASSIGNED = chars(0x378);
const LONE_SURROGATE = "\ud800";
const DECOMPOSED_N_CARON = `n${chars(0x30c)}`;

describe("normalizeCommandText", () => {
  it("trims and collapses whitespace runs", () => {
    expect(normalizeCommandText(`  Zoom ${NBSP}  to   Brno  `)).toBe(
      "Zoom to Brno",
    );
  });

  it.each([
    ["line breaks", "Zoom\nto\r\nBrno"],
    ["tabs", "Zoom\tto\tBrno"],
  ])("AC-5: turns %s into spaces", (_name, raw) => {
    expect(normalizeCommandText(raw)).toBe("Zoom to Brno");
  });

  it.each([
    ["zero-width space", `Br${ZERO_WIDTH_SPACE}no`],
    ["zero-width joiner", `Br${ZERO_WIDTH_JOINER}no`],
    ["byte order mark", `${BYTE_ORDER_MARK}Brno`],
    ["bidi override", `${BIDI_OVERRIDE}Brno${BIDI_POP}`],
    ["bidi isolate", `${BIDI_ISOLATE[0]}Brno${BIDI_ISOLATE[1]}`],
    ["null and other controls", `Br${CONTROLS}no`],
    ["line and paragraph separators", `Br${SEPARATORS}no`],
    ["private use", `Br${PRIVATE_USE}no`],
    ["unassigned", `Br${UNASSIGNED}no`],
    ["lone surrogate", `Br${LONE_SURROGATE}no`],
  ])("AC-5: removes %s", (_name, raw) => {
    expect(normalizeCommandText(raw)).toBe("Brno");
  });

  it("composes to NFC so diacritics compare equal", () => {
    expect(normalizeCommandText(`Plze${DECOMPOSED_N_CARON}`)).toBe("Plzeň");
  });

  it("AC-4: cuts to 200 code points, not UTF-16 units", () => {
    const result = normalizeCommandText("😀".repeat(300));

    expect(Array.from(result)).toHaveLength(MAX_COMMAND_LENGTH);
  });

  it("does not leave a trailing space after cutting", () => {
    const raw = `${"a".repeat(MAX_COMMAND_LENGTH - 1)} b`;

    expect(normalizeCommandText(raw)).toBe("a".repeat(MAX_COMMAND_LENGTH - 1));
  });

  it("is idempotent", () => {
    const once = normalizeCommandText(
      ` ${BIDI_OVERRIDE}Zoom\n to  P${ZERO_WIDTH_SPACE}lzen `.repeat(30),
    );

    expect(normalizeCommandText(once)).toBe(once);
  });
});

describe("isCleanCommandText", () => {
  it("accepts text that normalisation leaves unchanged", () => {
    expect(isCleanCommandText("Přibliž na Brno")).toBe(true);
  });

  it.each([
    ["empty text", ""],
    ["leading space", " Brno"],
    ["double space", "Zoom  Brno"],
    ["newline", "Zoom\nBrno"],
    ["zero-width character", `Br${ZERO_WIDTH_SPACE}no`],
    ["decomposed diacritics", `Plze${DECOMPOSED_N_CARON}`],
    ["201 characters", "a".repeat(MAX_COMMAND_LENGTH + 1)],
  ])("AC-4, AC-5: rejects %s", (_name, text) => {
    expect(isCleanCommandText(text)).toBe(false);
  });

  it("accepts exactly 200 characters", () => {
    expect(isCleanCommandText("a".repeat(MAX_COMMAND_LENGTH))).toBe(true);
  });
});
