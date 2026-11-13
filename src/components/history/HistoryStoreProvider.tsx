"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import { createSessionHistoryStorage } from "./historyStorage";
import {
  createHistoryStore,
  type HistoryState,
  type HistoryStore,
} from "./historyStore";

const HistoryStoreContext = createContext<HistoryStore | null>(null);

// Not crypto.randomUUID, which needs a secure context (plain http on a LAN has none).
function createEntryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createSessionHistoryStore() {
  return createHistoryStore({
    storage: createSessionHistoryStorage(),
    now: Date.now,
    newId: createEntryId,
  });
}

/** Provides the history store; tests pass their own `store` with a fake storage. */
export function HistoryStoreProvider({
  store,
  children,
}: {
  store?: HistoryStore;
  children: ReactNode;
}) {
  const [value] = useState(() => store ?? createSessionHistoryStore());
  return <HistoryStoreContext value={value}>{children}</HistoryStoreContext>;
}

export function useHistoryStore<T>(selector: (state: HistoryState) => T): T {
  const store = useContext(HistoryStoreContext);
  if (!store) throw new Error("useHistoryStore needs a HistoryStoreProvider");
  return useStore(store, selector);
}
