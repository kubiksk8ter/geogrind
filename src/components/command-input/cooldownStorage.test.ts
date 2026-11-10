import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCooldownEnd, saveCooldownEnd } from "./cooldownStorage";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("cooldown storage", () => {
  it("restores a cooldown that has not ended", () => {
    saveCooldownEnd(15_000);

    expect(readCooldownEnd(10_000)).toBe(15_000);
  });

  it.each([
    ["ended", 9_000],
    ["ending right now", 10_000],
  ])("ignores a cooldown that has %s", (_name, end) => {
    saveCooldownEnd(end);

    expect(readCooldownEnd(10_000)).toBeNull();
  });

  it("ignores missing and garbage values", () => {
    expect(readCooldownEnd(0)).toBeNull();
    window.localStorage.setItem("geogrind.commandCooldownUntil", "soon");
    expect(readCooldownEnd(0)).toBeNull();
  });

  it("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() => saveCooldownEnd(5)).not.toThrow();
    expect(readCooldownEnd(0)).toBeNull();
  });
});
