import type { HistoryEntry } from "@/components/history/historyEntrySchema";

/** A Map-based `Storage` that can be made to throw or to run out of space (test helper). */
export class FakeStorage implements Storage {
  readonly items = new Map<string, string>();
  /** Longest value setItem accepts; longer ones throw like a full storage. */
  maxValueLength = Number.POSITIVE_INFINITY;
  throwOnAccess = false;

  get length() {
    return this.items.size;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string) {
    if (this.throwOnAccess) throw new DOMException("denied", "SecurityError");
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.throwOnAccess) throw new DOMException("denied", "SecurityError");
    if (value.length > this.maxValueLength) {
      throw new DOMException("full", "QuotaExceededError");
    }
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
}

export function makeEntry(
  index: number,
  overrides: Partial<HistoryEntry> = {},
): HistoryEntry {
  return {
    id: `id-${index}`,
    at: 1_700_000_000_000 + index,
    text: `Zoom to place ${index}`,
    result: {
      action: "zoom_to_place",
      bounds: [
        [16.4, 49.1],
        [16.7, 49.3],
      ],
    },
    ...overrides,
  };
}
