import "server-only";
import type { AppEnv } from "../config/env";
import { createFileStateStore } from "../state/createFileStateStore";
import { pruneState } from "../state/rules";
import type { Clock } from "../state/types";
import type { ClientKeyring } from "./clientKeyring";
import { ClientScopedStateStore } from "./clientScopedStateStore";

export interface SweepJobDeps {
  clock: Clock;
  keyring: Pick<ClientKeyring, "discardIfExpired" | "validKeyId">;
  /** Read at call time, so a broken configuration fails this sweep only. */
  loadEnv(): AppEnv;
}

/**
 * Destroys an expired key, then rewrites the state once: client records of other keys go (all
 * of them when no key lives), expired data is pruned. Never creates a key.
 */
export function createSweepJob({
  clock,
  keyring,
  loadEnv,
}: SweepJobDeps): () => Promise<void> {
  return async () => {
    keyring.discardIfExpired();
    const store = new ClientScopedStateStore(
      createFileStateStore(loadEnv()),
      () => keyring.validKeyId(),
    );
    await store.transact((state) => ({
      next: pruneState(state, clock.now()),
      result: undefined,
    }));
  };
}
