import type { StateData, StateStore } from "../state/types";
import { purgeForeignClients } from "./pseudonym";

/**
 * A StateStore that never saves or returns client records of another key: whatever a writer
 * produces is purged before it is written, and what is read is purged in memory. Old-key
 * pseudonyms and raw ids of earlier versions therefore vanish on the first write.
 */
export class ClientScopedStateStore implements StateStore {
  constructor(
    private readonly inner: StateStore,
    /** keyId of the live key, asked at the moment of the write; must never create a key. */
    private readonly validKeyId: () => string | null,
  ) {}

  transact<T>(
    fn: (state: StateData) => { next: StateData; result: T },
  ): Promise<T> {
    return this.inner.transact((state) => {
      const { next, result } = fn(state);
      return { next: purgeForeignClients(next, this.validKeyId()), result };
    });
  }

  async read(): Promise<StateData> {
    return purgeForeignClients(await this.inner.read(), this.validKeyId());
  }
}
