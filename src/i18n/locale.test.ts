import { describe, expect, it } from "vitest";
import { LOCALE_LABELS, localeCookie, localizedPath } from "./locale";

describe("localizedPath", () => {
  it("AC-6: switches /cs to /en and back", () => {
    expect(localizedPath("/cs", "en")).toBe("/en");
    expect(localizedPath("/en", "cs")).toBe("/cs");
  });

  it("keeps the rest of the path, query and hash", () => {
    expect(localizedPath("/cs/foo/bar?x=1#top", "en")).toBe(
      "/en/foo/bar?x=1#top",
    );
    expect(localizedPath("/cs?x=1", "en")).toBe("/en?x=1");
    expect(localizedPath("/cs#top", "en")).toBe("/en#top");
  });

  it("is the identity for the same locale", () => {
    expect(localizedPath("/cs/foo?x=1#a", "cs")).toBe("/cs/foo?x=1#a");
  });
});

describe("localeCookie", () => {
  it("describes next-intl's session cookie", () => {
    expect(localeCookie("en")).toEqual({
      name: "NEXT_LOCALE",
      value: "en",
      path: "/",
      sameSite: "lax",
    });
  });
});

describe("LOCALE_LABELS", () => {
  it("NFR-2: uses the same visible labels in both languages", () => {
    expect(LOCALE_LABELS).toEqual({ cs: "CZ", en: "EN" });
  });
});
