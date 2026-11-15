import type { MetricsSnapshot } from "@/shared/metricsContract";
import { nextUtcMidnight, pruneState } from "../state/rules";
import type { StateData } from "../state/types";
import type { AiFigures } from "./aiFigures";

export interface SnapshotInput {
  state: StateData;
  figures: ReturnType<AiFigures["current"]>;
  model: string;
  dailyCap: number;
  now: number;
}

/** Pruned in memory only, so after UTC midnight the day's figures read 0 without a write. */
export function buildSnapshot({
  state,
  figures,
  model,
  dailyCap,
  now,
}: SnapshotInput): MetricsSnapshot {
  const { daily } = pruneState(state, now);
  return {
    serverNow: now,
    ai: {
      model,
      dailyCap: {
        used: daily.count,
        cap: dailyCap,
        resetsAt: nextUtcMidnight(now),
      },
      dailyTokens: daily.tokens,
      lastRequest: figures.lastRequest,
      limits: figures.limits,
    },
  };
}
