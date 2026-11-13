import { describe, expect, it } from "vitest";
import { entryLabel } from "./entryLabel";

describe("entryLabel", () => {
  it("shortens a long text to its first sentence and an ellipsis", () => {
    expect(
      entryLabel(
        "Zobraz mi Grand Canyon v Americe. Nevím, kde přesně je, blablabla",
      ),
    ).toBe("Zobraz mi Grand Canyon v Americe…");
  });

  it("keeps a short text as typed, even with several sentences", () => {
    expect(entryLabel("Ahoj. Zobraz Brno")).toBe("Ahoj. Zobraz Brno");
  });

  it("returns a long text without a sentence end whole", () => {
    const text = "Zobraz mi Grand Canyon v Americe a pak ještě něco dalšího";

    expect(entryLabel(text)).toBe(text);
  });

  it("ignores a dot that is not followed by a space", () => {
    const text = "Zobraz mi verzi 2.0 Grand Canyonu v Americe prosím";

    expect(entryLabel(text)).toBe(text);
  });

  it("does not cut after a very short first sentence", () => {
    const text = "Hm. Zobraz mi Grand Canyon v Americe a ještě okolí";

    expect(entryLabel(text)).toBe(text);
  });

  it("also cuts at a question or exclamation mark", () => {
    expect(entryLabel("Kde je Grand Canyon v Americe? Chci ho vidět!")).toBe(
      "Kde je Grand Canyon v Americe…",
    );
  });
});
