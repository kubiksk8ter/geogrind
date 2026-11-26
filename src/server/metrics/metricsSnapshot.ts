import type { AppMetrics, MetricsSnapshot } from "@/shared/metricsContract";
import { nextUtcMidnight, pruneState } from "../state/rules";
import type { StateData } from "../state/types";
import type { AiFigures } from "./ai/aiFigures";
import type { WindowSummary } from "./app/commandWindow";

export interface SnapshotInput {
  state: StateData;
  figures: ReturnType<AiFigures["current"]>;
  window: WindowSummary;
  nominatim: boolean | null;
  model: string;
  dailyCap: number;
  now: number;
}

/** Commands whose in-flight mark is still live are being processed right now. */
function commandsInProgress(state: StateData): number {
  return Object.values(state.clients).filter(
    (client) => client.inflightUntil !== undefined,
  ).length;
}

/** Pruned in memory only, so after UTC midnight the day's figures read 0 without a write. */
export function buildSnapshot({
  state,
  figures,
  window,
  nominatim,
  model,
  dailyCap,
  now,
}: SnapshotInput): MetricsSnapshot {
  const pruned = pruneState(state, now);
  const { daily } = pruned;
  const app: AppMetrics = {
    results: daily.results,
    window: window.window,
    load: { ...window.load, inProgress: commandsInProgress(pruned) },
    latency: window.latency,
    services: { nominatim },
  };
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
    app,
  };
}
