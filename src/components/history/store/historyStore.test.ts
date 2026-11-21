import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "@/test/fakeStorage";
import { type HistoryEntry, MAX_HISTORY_ENTRIES } from "./historyEntrySchema";
import type { HistoryStorage } from "./historyStorage";
import { createHistoryStore } from "./historyStore";

const RESULT = makeEntry(0).result;

function setup(initial: HistoryEntry[] = []) {
  const save = vi.fn<HistoryStorage["save"]>();
  const storage: HistoryStorage = { load: () => initial, save };
  let time = 1000;
  let nextId = 0;
  const store = createHistoryStore({
    storage,
    now: () => time++,
    newId: () => `new-${nextId++}`,
  });
  return { store, save };
}

describe("history store", () => {
  it("starts with the loaded entries", () => {
    const loaded = [makeEntry(1)];

    expect(setup(loaded).store.getState().entries).toEqual(loaded);
  });

  it("FR-4: addEntry stamps the time, creates an id and puts the entry first", () => {
    const { store } = setup();

    store.getState().addEntry("Zoom to Brno", RESULT);
    store.getState().addEntry("Zoom to Plzen", RESULT);

    expect(store.getState().entries).toEqual([
      { id: "new-1", at: 1001, text: "Zoom to Plzen", result: RESULT },
      { id: "new-0", at: 1000, text: "Zoom to Brno", result: RESULT },
    ]);
  });

  it("FR-10: the same place commanded again adds a second entry", () => {
    const { store } = setup();

    store.getState().addEntry("Brno", RESULT);
    store.getState().addEntry("Brno", RESULT);

    expect(store.getState().entries).toHaveLength(2);
  });

  it("AC-12: the 51st entry removes the oldest one", () => {
    const initial = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, i) =>
      makeEntry(MAX_HISTORY_ENTRIES - i),
    );
    const { store } = setup(initial);

    store.getState().addEntry("Newest", RESULT);

    const { entries } = store.getState();
    expect(entries).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(entries[0]?.text).toBe("Newest");
    expect(entries.at(-1)?.id).toBe("id-2");
  });

  it("FR-6: saves the entries after every change of them", () => {
    const { store, save } = setup();

    store.getState().addEntry("Brno", RESULT);

    expect(save).toHaveBeenCalledExactlyOnceWith(store.getState().entries);
  });

  it("does not write when only the in-flight flag changes", () => {
    const { store, save } = setup();

    store.getState().setCommandInFlight(true);

    expect(store.getState().commandInFlight).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("does not write at creation", () => {
    expect(setup([makeEntry(1)]).save).not.toHaveBeenCalled();
  });
});
