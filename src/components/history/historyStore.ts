import { createStore, type StoreApi } from "zustand/vanilla";
import type { CommandResult } from "@/shared/actions";
import { type HistoryEntry, MAX_HISTORY_ENTRIES } from "./historyEntrySchema";
import type { HistoryStorage } from "./historyStorage";

export interface HistoryState {
  /** Newest first, at most MAX_HISTORY_ENTRIES. */
  entries: readonly HistoryEntry[];
  /** True while a command request is running; memory only, never persisted. */
  commandInFlight: boolean;
  addEntry(text: string, result: CommandResult): void;
  setCommandInFlight(value: boolean): void;
}

export type HistoryStore = StoreApi<HistoryState>;

export interface HistoryStoreDependencies {
  storage: HistoryStorage;
  now(): number;
  newId(): string;
}

export function createHistoryStore({
  storage,
  now,
  newId,
}: HistoryStoreDependencies): HistoryStore {
  const store = createStore<HistoryState>()((set) => ({
    entries: storage.load(),
    commandInFlight: false,
    addEntry(text, result) {
      const entry: HistoryEntry = { id: newId(), at: now(), text, result };
      set((state) => ({
        entries: [entry, ...state.entries].slice(0, MAX_HISTORY_ENTRIES),
      }));
    },
    setCommandInFlight(value) {
      set({ commandInFlight: value });
    },
  }));

  // Only a change of the entries is written, never the in-flight flag.
  let persisted = store.getState().entries;
  store.subscribe(({ entries }) => {
    if (entries === persisted) return;
    persisted = entries;
    storage.save(entries);
  });
  return store;
}
