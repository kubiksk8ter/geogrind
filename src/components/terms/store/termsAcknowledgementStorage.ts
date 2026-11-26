import * as v from "valibot";
import type { PersistStorage, StorageValue } from "zustand/middleware";

/** What is kept in the browser: only the version of the acknowledged terms (null: none). */
export interface PersistedAcknowledgement {
  acknowledgedVersion: string | null;
}

export const ACKNOWLEDGEMENT_STORAGE_KEY = "geogrind.termsAcknowledgement";
/** Version of the stored shape (not of the terms); a different one is ignored. */
export const ACKNOWLEDGEMENT_STORAGE_VERSION = 1;

const storedValueSchema = v.object({
  state: v.object({ acknowledgedVersion: v.nullable(v.string()) }),
  version: v.literal(ACKNOWLEDGEMENT_STORAGE_VERSION),
});

/**
 * Persist storage for the acknowledgement that never throws: a missing, corrupt or unknown value
 * reads as none, and a blocked or full storage only means the acknowledgement lasts for this
 * page view.
 */
export function createAcknowledgementStorage(
  getStorage: () => Storage = () => window.localStorage,
): PersistStorage<PersistedAcknowledgement> {
  return {
    getItem(name): StorageValue<PersistedAcknowledgement> | null {
      try {
        const raw = getStorage().getItem(name);
        if (raw === null) return null;
        const parsed = v.safeParse(storedValueSchema, JSON.parse(raw));
        return parsed.success ? parsed.output : null;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      try {
        getStorage().setItem(name, JSON.stringify(value));
      } catch {
        // Ignored on purpose, see above.
      }
    },
    removeItem(name) {
      try {
        getStorage().removeItem(name);
      } catch {
        // Nothing to remove from a storage that cannot be reached.
      }
    },
  };
}
