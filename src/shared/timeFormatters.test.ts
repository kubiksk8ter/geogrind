import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatCountdown,
  formatDuration,
  formatEntryTime,
} from "./timeFormatters";

// Intl uses non-breaking spaces; tests compare with plain ones.
const plain = (text: string) => text.replace(/[  ]/g, " ");

// Local-time constructors, so the test does not depend on the machine's time zone.
const NOW = new Date(2026, 10, 11, 18, 30).getTime();
const EARLIER_TODAY = new Date(2026, 10, 11, 9, 5).getTime();
const YESTERDAY = new Date(2026, 10, 10, 23, 59).getTime();

describe("formatEntryTime", () => {
  it("AC-3: shows only the time for today, without the date", () => {
    const text = formatEntryTime(EARLIER_TODAY, NOW, "en");

    expect(text).toMatch(/9:05/);
    expect(text).not.toMatch(/2026|Nov/);
  });

  it("AC-3: shows date and time for an earlier day, in English", () => {
    const text = formatEntryTime(YESTERDAY, NOW, "en");

    expect(text).toMatch(/Nov 10, 2026/);
    expect(text).toMatch(/11:59/);
  });

  it("AC-14: formats for Czech", () => {
    expect(formatEntryTime(EARLIER_TODAY, NOW, "cs")).toMatch(/9:05/);
    const earlier = formatEntryTime(YESTERDAY, NOW, "cs");
    expect(earlier).toMatch(/10\. 11\. 2026/);
    expect(earlier).toMatch(/23:59/);
  });
});

describe("formatCountdown", () => {
  it.each([
    ["en", 7_660, "8 sec"],
    ["en", 3_723_000, "1 hr, 2 min, 3 sec"],
    ["en", 93_600_000, "1 day, 2 hr"],
    ["en", 250, "1 sec"],
    ["en", 0, "0 sec"],
    ["en", -5_000, "0 sec"],
    ["cs", 7_660, "8 s"],
    ["cs", 3_723_000, "1 h, 2 min a 3 s"],
  ] as const)("AC-7: %s %i ms reads %s", (locale, ms, expected) => {
    expect(plain(formatCountdown(ms, locale))).toBe(expected);
  });

  it("AC-7: carries 60 s into the minutes", () => {
    expect(plain(formatCountdown(179_560, "en"))).toBe("3 min");
    expect(plain(formatCountdown(58_001, "cs"))).toBe("59 s");
    expect(plain(formatCountdown(59_999, "cs"))).toBe("1 min");
    expect(plain(formatCountdown(119_100, "cs"))).toBe("2 min");
  });
});

describe("formatDuration", () => {
  it.each([
    ["en", 820, "820 ms"],
    ["en", 0, "0 ms"],
    ["en", 999.4, "999 ms"],
    ["en", 999.6, "1 sec"],
    ["en", 1_450, "1.5 sec"],
    ["en", 12_000, "12 sec"],
    ["en", 1_234_000, "1,234 sec"],
    ["cs", 820, "820 ms"],
    ["cs", 1_450, "1,5 s"],
    ["cs", 12_000, "12 s"],
  ] as const)("FR-5, AC-16: %s %d ms reads %s", (locale, ms, expected) => {
    expect(plain(formatDuration(ms, locale))).toBe(expected);
  });

  it("never reads a negative time", () => {
    expect(plain(formatDuration(-5, "en"))).toBe("0 ms");
  });
});

describe("formatClock", () => {
  it("shows zero-padded hours, minutes and seconds", () => {
    expect(formatClock(5 * 3_600_000 + 3 * 60_000 + 9_000)).toBe("05h 03m 09s");
    expect(formatClock(12 * 3_600_000)).toBe("12h 00m 00s");
  });

  it("rounds seconds up and carries them, so 60 s never appears", () => {
    expect(formatClock(59_001)).toBe("00h 01m 00s");
    expect(formatClock(1)).toBe("00h 00m 01s");
  });

  it("reads zero for zero and negative values and does not wrap hours", () => {
    expect(formatClock(0)).toBe("00h 00m 00s");
    expect(formatClock(-5_000)).toBe("00h 00m 00s");
    expect(formatClock(100 * 3_600_000)).toBe("100h 00m 00s");
  });
});
