import "server-only";
import type { AppEnv } from "../config/env";
import { ClientScopedStateStore } from "../privacy/clientScopedStateStore";
import { sharedClientKeyring } from "../privacy/shared";
import { createFileStateStore } from "./createFileStateStore";
import type { StateStore } from "./types";

/** The store of the configured state folder; it keeps only client records of the live key. */
export function createScopedStateStore(env: AppEnv): StateStore {
  return new ClientScopedStateStore(createFileStateStore(env), () =>
    sharedClientKeyring().validKeyId(),
  );
}
