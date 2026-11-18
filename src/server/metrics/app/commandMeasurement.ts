import type { ResultKey } from "@/shared/metricsContract";
import { addResult } from "../../state/rules";
import type { Clock, StateStore } from "../../state/types";
import type { CommandWindow } from "./commandWindow";

/** One processed command: its result and duration, no content. */
export interface CommandMeasurement {
  result: ResultKey;
  durationMs: number;
  /** The raw client id; the window digests it at once and nothing else keeps it. */
  clientId: string | null;
}

/** Never throws: a failure is logged as a code and dropped. */
export type CommandMeasurementRecorder = (entry: CommandMeasurement) => void;

export interface CommandMeasurementDeps {
  window: CommandWindow;
  /** Opened per measurement, so a broken configuration is caught here, not in the command. */
  openStore(): StateStore;
  clock: Clock;
  /** Receives the error name only, never content. */
  log(code: string): void;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

export function createCommandMeasurement({
  window,
  openStore,
  clock,
  log,
}: CommandMeasurementDeps): CommandMeasurementRecorder {
  return (entry) => {
    try {
      window.record(entry);
      const now = clock.now();
      // Not awaited: collecting metrics never delays a command.
      openStore()
        .transact((state) => addResult(state, entry.result, now))
        .catch((error: unknown) => log(errorName(error)));
    } catch (error) {
      log(errorName(error));
    }
  };
}
