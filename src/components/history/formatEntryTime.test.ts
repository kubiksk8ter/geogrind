import { describe, expect, it } from "vitest";
import { formatEntryTime } from "./formatEntryTime";

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

  it("a different year is an earlier day", () => {
    const lastYear = new Date(2025, 10, 11, 18, 30).getTime();

    expect(formatEntryTime(lastYear, NOW, "en")).toMatch(/2025/);
  });
});
