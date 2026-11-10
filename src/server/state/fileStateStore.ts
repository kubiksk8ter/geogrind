import "server-only";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as v from "valibot";
import {
  EMPTY_STATE,
  type StateData,
  type StateStore,
  StateUnavailableError,
  stateDataSchema,
} from "./types";

export interface FileStateStoreOptions {
  /** How long to wait for the lock file before giving up. */
  lockTimeoutMs: number;
  /** A lock file older than this is a leftover of a crashed process. */
  lockStaleMs: number;
  lockRetryMs: number;
}

const DEFAULT_OPTIONS: FileStateStoreOptions = {
  lockTimeoutMs: 3_000,
  lockStaleMs: 10_000,
  lockRetryMs: 25,
};

// Bundles may contain this module more than once, so the queues live on globalThis.
declare global {
  var geogrindStateQueues: Map<string, Promise<void>> | undefined;
}

function queues(): Map<string, Promise<void>> {
  globalThis.geogrindStateQueues ??= new Map();
  return globalThis.geogrindStateQueues;
}

async function runExclusive<T>(key: string, task: () => Promise<T>) {
  const all = queues();
  const run = (all.get(key) ?? Promise.resolve()).then(task);
  all.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

const isErrnoCode = (error: unknown, code: string) =>
  error instanceof Error && "code" in error && error.code === code;

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * One JSON file. Writers are serialised in the process (queue) and across processes (lock
 * file); a write goes to a temporary file first and is renamed, so a crash never leaves half
 * a file. Anything unexpected becomes StateUnavailableError and nothing is repaired silently.
 */
export class FileStateStore implements StateStore {
  private readonly stateFile: string;
  private readonly lockFile: string;
  private readonly options: FileStateStoreOptions;

  constructor(
    private readonly directory: string,
    options: Partial<FileStateStoreOptions> = {},
  ) {
    this.stateFile = join(directory, "state.json");
    this.lockFile = join(directory, "state.lock");
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async transact<T>(
    fn: (state: StateData) => { next: StateData; result: T },
  ): Promise<T> {
    return runExclusive(this.stateFile, async () => {
      await this.guard(() => mkdir(this.directory, { recursive: true }));
      await this.acquireLock();
      try {
        const { next, result } = fn(await this.read());
        await this.write(next);
        return result;
      } finally {
        await rm(this.lockFile, { force: true }).catch(() => undefined);
      }
    });
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new StateUnavailableError("State storage failed", {
        cause: error,
      });
    }
  }

  private async acquireLock(): Promise<void> {
    const { lockTimeoutMs, lockRetryMs } = this.options;
    const deadline = Date.now() + lockTimeoutMs;
    while (!(await this.tryCreateLock())) {
      if (Date.now() >= deadline) {
        throw new StateUnavailableError("State lock timed out");
      }
      await sleep(lockRetryMs);
    }
  }

  private async tryCreateLock(): Promise<boolean> {
    try {
      await writeFile(this.lockFile, String(process.pid), { flag: "wx" });
      return true;
    } catch (error) {
      if (!isErrnoCode(error, "EEXIST")) {
        throw new StateUnavailableError("State lock failed", { cause: error });
      }
      await this.removeStaleLock();
      return false;
    }
  }

  private async removeStaleLock(): Promise<void> {
    try {
      const { mtimeMs } = await stat(this.lockFile);
      if (Date.now() - mtimeMs > this.options.lockStaleMs) {
        await rm(this.lockFile, { force: true });
      }
    } catch {
      // The holder released it meanwhile; the next attempt decides.
    }
  }

  private async read(): Promise<StateData> {
    let raw: string;
    try {
      raw = await readFile(this.stateFile, "utf8");
    } catch (error) {
      if (isErrnoCode(error, "ENOENT")) return EMPTY_STATE;
      throw new StateUnavailableError("State file unreadable", {
        cause: error,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new StateUnavailableError("State file is not valid JSON", {
        cause: error,
      });
    }
    const result = v.safeParse(stateDataSchema, parsed);
    if (!result.success) {
      throw new StateUnavailableError("State file has an unexpected shape");
    }
    return result.output;
  }

  private async write(state: StateData): Promise<void> {
    const temporaryFile = `${this.stateFile}.${process.pid}.tmp`;
    await this.guard(async () => {
      await writeFile(temporaryFile, JSON.stringify(state), "utf8");
      await rename(temporaryFile, this.stateFile);
    });
  }
}
