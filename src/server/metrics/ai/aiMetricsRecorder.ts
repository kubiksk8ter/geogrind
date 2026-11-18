import type { AiAnswer } from "../../ai/aiAnswer";
import { addTokens } from "../../state/rules";
import type { Clock, StateStore } from "../../state/types";
import type { AiFigures } from "./aiFigures";

export interface AiMetricsRecorder {
  /** Never rejects: a failure is logged as a code and dropped. */
  record(answer: AiAnswer): Promise<void>;
}

export interface AiMetricsRecorderDeps {
  store: StateStore;
  figures: AiFigures;
  clock: Clock;
  /** Receives the error name only, never content. */
  log(code: string): void;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

export function createAiMetricsRecorder({
  store,
  figures,
  clock,
  log,
}: AiMetricsRecorderDeps): AiMetricsRecorder {
  return {
    async record(answer) {
      try {
        figures.update(answer);
        const total = answer.usage?.total;
        if (total === null || total === undefined) return;
        await store.transact((state) => addTokens(state, total, clock.now()));
      } catch (error) {
        log(errorName(error));
      }
    },
  };
}
