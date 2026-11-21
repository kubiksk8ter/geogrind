import * as v from "valibot";
import {
  type HistoryEntry,
  historyEntrySchema,
  MAX_HISTORY_ENTRIES,
} from "./historyEntrySchema";

const STORAGE_KEY = "geogrind.history";
const STORAGE_VERSION = 1;

export interface HistoryStorage {
  /** Never throws; entries that fail validation are dropped. Newest first. */
  load(): HistoryEntry[];
  /** Never throws; stores the newest entries that fit and ignores any failure. */
  save(entries: readonly HistoryEntry[]): void;
}

const envelopeSchema = v.object({
  version: v.literal(STORAGE_VERSION),
  entries: v.array(v.unknown()),
});

function tryWrite(storage: Storage, entries: readonly HistoryEntry[]) {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, entries }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Drops the oldest entries one by one until the storage accepts the rest (none: clears it). */
function storeWhatFits(storage: Storage, entries: readonly HistoryEntry[]) {
  for (let count = entries.length - 1; count > 0; count--) {
    if (tryWrite(storage, entries.slice(0, count))) return;
  }
  // A failed write leaves the previous list behind, which would come back after a reload.
  storage.removeItem(STORAGE_KEY);
}

/** History in session storage: survives a reload of the tab and ends with the tab. */
export function createSessionHistoryStorage(
  getStorage: () => Storage = () => window.sessionStorage,
): HistoryStorage {
  return {
    load() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return [];
        const envelope = v.safeParse(envelopeSchema, JSON.parse(raw));
        if (!envelope.success) return [];
        const seenIds = new Set<string>();
        return envelope.output.entries
          .flatMap((candidate) => {
            const entry = v.safeParse(historyEntrySchema, candidate);
            if (!entry.success || seenIds.has(entry.output.id)) return [];
            seenIds.add(entry.output.id);
            return [entry.output];
          })
          .slice(0, MAX_HISTORY_ENTRIES);
      } catch {
        return [];
      }
    },
    save(entries) {
      try {
        const storage = getStorage();
        if (tryWrite(storage, entries)) return;
        storeWhatFits(storage, entries);
      } catch {
        // Storage is unavailable; the history stays in memory for this page view.
      }
    },
  };
}
