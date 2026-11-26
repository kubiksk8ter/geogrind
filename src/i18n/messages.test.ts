import { describe, expect, it } from "vitest";
import cs from "../../messages/cs.json";
import en from "../../messages/en.json";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("messages", () => {
  it("NFR-2: cs and en have identical key sets", () => {
    expect(keyPaths(cs).sort()).toEqual(keyPaths(en).sort());
  });
});
