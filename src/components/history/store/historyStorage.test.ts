import { describe, expect, it } from "vitest";
import { FakeStorage, makeEntry } from "@/test/fakeStorage";
import { MAX_HISTORY_ENTRIES } from "./historyEntrySchema";
import { createSessionHistoryStorage } from "./historyStorage";

const KEY = "geogrind.history";

function setup() {
  const fake = new FakeStorage();
  return { fake, storage: createSessionHistoryStorage(() => fake) };
}

const envelope = (entries: unknown[]) =>
  JSON.stringify({ version: 1, entries });

describe("history storage", () => {
  it("AC-5: loads what was saved, in the same order", () => {
    const { storage } = setup();
    const entries = [makeEntry(2), makeEntry(1)];

    storage.save(entries);

    expect(storage.load()).toEqual(entries);
  });

  it("keeps entries with a highlight intact", () => {
    const { storage } = setup();
    const entry = makeEntry(1, {
      result: {
        action: "zoom_to_place",
        bounds: [
          [16, 49],
          [17, 50],
        ],
        highlight: { type: "Point", coordinates: [16.5, 49.5] },
      },
    });

    storage.save([entry]);

    expect(storage.load()).toEqual([entry]);
  });

  it("loads an empty history when nothing is stored", () => {
    expect(setup().storage.load()).toEqual([]);
  });

  it.each([
    ["corrupt JSON", "{not json"],
    ["a different version", JSON.stringify({ version: 2, entries: [] })],
    ["no envelope", JSON.stringify([makeEntry(1)])],
    ["entries that are not a list", JSON.stringify({ version: 1, entries: 5 })],
  ])("AC-12: %s gives an empty history", (_name, raw) => {
    const { fake, storage } = setup();
    fake.items.set(KEY, raw);

    expect(storage.load()).toEqual([]);
  });

  it.each([
    [
      "an out-of-range result",
      makeEntry(9, {
        result: {
          action: "zoom_to_place",
          bounds: [
            [200, 0],
            [201, 1],
          ],
        },
      }),
    ],
    ["an unclean text", makeEntry(9, { text: "  padded  " })],
    ["an empty text", makeEntry(9, { text: "" })],
    ["a missing id", { ...makeEntry(9), id: undefined }],
    ["a non-number time", { ...makeEntry(9), at: "yesterday" }],
    ["a time outside the date range", makeEntry(9, { at: 8.64e15 + 1 })],
    ["an unknown action", { ...makeEntry(9), result: { action: "route" } }],
    ["a non-object", "text"],
  ])("FR-14: drops %s and keeps the valid entries", (_name, bad) => {
    const { fake, storage } = setup();
    const good = [makeEntry(2), makeEntry(1)];
    fake.items.set(KEY, envelope([good[0], bad, good[1]]));

    expect(storage.load()).toEqual(good);
  });

  it("keeps only the first entry of each id on load", () => {
    const { fake, storage } = setup();
    const first = makeEntry(1, { id: "same" });
    const duplicate = makeEntry(2, { id: "same" });
    fake.setItem(KEY, envelope([first, duplicate, makeEntry(3)]));

    expect(storage.load()).toEqual([first, makeEntry(3)]);
  });

  it("keeps at most the newest 50 entries on load", () => {
    const { fake, storage } = setup();
    const many = Array.from({ length: 60 }, (_, i) => makeEntry(60 - i));
    fake.items.set(KEY, envelope(many));

    const loaded = storage.load();

    expect(loaded).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(loaded[0]).toEqual(many[0]);
  });

  it("AC-12: a throwing storage loads empty and saves silently", () => {
    const { fake, storage } = setup();
    fake.throwOnAccess = true;

    expect(storage.load()).toEqual([]);
    expect(() => storage.save([makeEntry(1)])).not.toThrow();
  });

  it("AC-12: an unreachable sessionStorage object is handled", () => {
    const storage = createSessionHistoryStorage(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(storage.load()).toEqual([]);
    expect(() => storage.save([makeEntry(1)])).not.toThrow();
  });

  it("FR-13: a full storage keeps the newest entries that fit", () => {
    const { fake, storage } = setup();
    const entries = Array.from({ length: 20 }, (_, i) => makeEntry(20 - i));
    fake.maxValueLength = JSON.stringify(makeEntry(1)).length * 7 + 40;

    storage.save(entries);

    const loaded = storage.load();
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.length).toBeLessThan(entries.length);
    expect(loaded).toEqual(entries.slice(0, loaded.length));
    // It is the largest count that fits: one more entry would be rejected.
    expect(() =>
      fake.setItem(KEY, envelope(entries.slice(0, loaded.length + 1))),
    ).toThrow();
  });

  it("FR-13: when not even one entry fits nothing is stored and old data is gone", () => {
    const { fake, storage } = setup();
    storage.save([makeEntry(1)]);
    fake.maxValueLength = 10;

    storage.save([makeEntry(2), makeEntry(1)]);

    expect(fake.items.has(KEY)).toBe(false);
    expect(storage.load()).toEqual([]);
  });

  it("FR-13: unreadable stored data is replaced by the next save", () => {
    const { fake, storage } = setup();
    fake.items.set(KEY, "{not json");

    storage.save([makeEntry(1)]);

    expect(storage.load()).toEqual([makeEntry(1)]);
  });
});
