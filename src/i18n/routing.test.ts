import { describe, expect, it } from "vitest";
import { routing } from "./routing";

describe("routing", () => {
  it("AC-6: supports cs and en, defaults to cs, always prefixes the locale", () => {
    expect(routing.locales).toEqual(["cs", "en"]);
    expect(routing.defaultLocale).toBe("cs");
    expect(routing.localePrefix).toBe("always");
  });
});
