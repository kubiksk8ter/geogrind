"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import { TERMS_VERSION } from "../termsConstants";
import { createAcknowledgementStorage } from "./termsAcknowledgementStorage";
import {
  createTermsAcknowledgementStore,
  needsTermsNotice,
  type TermsAcknowledgementStore,
} from "./termsAcknowledgementStore";

const TermsAcknowledgementContext =
  createContext<TermsAcknowledgementStore | null>(null);

function createLocalTermsAcknowledgementStore() {
  return createTermsAcknowledgementStore({
    storage: createAcknowledgementStorage(),
    currentVersion: TERMS_VERSION,
  });
}

/** Provides the acknowledgement store; tests pass their own `store` with a fake storage. */
export function TermsAcknowledgementProvider({
  store,
  children,
}: {
  store?: TermsAcknowledgementStore;
  children: ReactNode;
}) {
  const [value] = useState(
    () => store ?? createLocalTermsAcknowledgementStore(),
  );
  return (
    <TermsAcknowledgementContext value={value}>
      {children}
    </TermsAcknowledgementContext>
  );
}

export interface TermsNoticeState {
  /** True while the current terms version has not been acknowledged. */
  noticeNeeded: boolean;
  acknowledge(): void;
}

export function useTermsNotice(): TermsNoticeState {
  const store = useContext(TermsAcknowledgementContext);
  if (!store) {
    throw new Error("useTermsNotice needs a TermsAcknowledgementProvider");
  }
  const noticeNeeded = useStore(store, needsTermsNotice);
  const acknowledge = useStore(store, (state) => state.acknowledge);
  return { noticeNeeded, acknowledge };
}
