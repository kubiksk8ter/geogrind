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
});
