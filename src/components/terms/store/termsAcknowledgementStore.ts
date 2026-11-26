import { type PersistStorage, persist } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  ACKNOWLEDGEMENT_STORAGE_KEY,
  ACKNOWLEDGEMENT_STORAGE_VERSION,
  type PersistedAcknowledgement,
} from "./termsAcknowledgementStorage";

export interface TermsAcknowledgementState extends PersistedAcknowledgement {
  /** Version of the terms texts in this build; never persisted. */
  currentVersion: string;
  /** Records the acknowledgement of the current version; makes no request to the server. */
  acknowledge(): void;
}

export type TermsAcknowledgementStore = StoreApi<TermsAcknowledgementState>;

export interface TermsAcknowledgementStoreDependencies {
  storage: PersistStorage<PersistedAcknowledgement>;
  currentVersion: string;
}

/**
 * The stored acknowledgement is read while the store is created (the storage is synchronous),
 * so the first render already knows whether the notice is needed.
 */
export function createTermsAcknowledgementStore({
  storage,
  currentVersion,
}: TermsAcknowledgementStoreDependencies): TermsAcknowledgementStore {
  return createStore<TermsAcknowledgementState>()(
    persist(
      (set) => ({
        acknowledgedVersion: null,
        currentVersion,
        acknowledge() {
          set({ acknowledgedVersion: currentVersion });
        },
      }),
      {
        name: ACKNOWLEDGEMENT_STORAGE_KEY,
        version: ACKNOWLEDGEMENT_STORAGE_VERSION,
        storage,
        // Nothing but the acknowledged version is ever written.
        partialize: ({ acknowledgedVersion }) => ({ acknowledgedVersion }),
        // Only the acknowledged version may come from the storage, never the current one.
        merge: (persisted, current) => ({
          ...current,
          acknowledgedVersion: isPersistedAcknowledgement(persisted)
            ? persisted.acknowledgedVersion
            : current.acknowledgedVersion,
        }),
      },
    ),
  );
}

function isPersistedAcknowledgement(
  value: unknown,
): value is PersistedAcknowledgement {
  return (
    typeof value === "object" &&
    value !== null &&
    "acknowledgedVersion" in value &&
    (typeof value.acknowledgedVersion === "string" ||
      value.acknowledgedVersion === null)
  );
}

/** The notice is due until exactly the current version has been acknowledged. */
export function needsTermsNotice({
  acknowledgedVersion,
  currentVersion,
}: Pick<
  TermsAcknowledgementState,
  "acknowledgedVersion" | "currentVersion"
>): boolean {
  return acknowledgedVersion !== currentVersion;
}
