import "server-only";
import { resolve } from "node:path";
import type { AppEnv } from "../config/env";
import { FileStateStore } from "./fileStateStore";
import type { StateStore } from "./types";

/** The store of the configured state folder; instances on one folder share the file and its lock. */
export function createStateStore({ stateDir }: AppEnv): StateStore {
  return new FileStateStore(
    // A runtime data folder, not a source file: it must not make Turbopack trace the project.
    resolve(/* turbopackIgnore: true */ process.cwd(), stateDir),
  );
}
