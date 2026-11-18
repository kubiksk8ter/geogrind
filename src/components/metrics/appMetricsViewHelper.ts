import type { MapAvailability } from "@/map";
import {
  type AppMetrics,
  RESULT_KEYS,
  type ResultKey,
} from "@/shared/metricsContract";

/** The same three states for every service light. */
export type ServiceState = MapAvailability;

const MINUTE_MS = 60_000;

/** The hour window is still shorter than an hour since the server started. */
export function isPartialWindow(
  window: AppMetrics["window"],
  serverNow: number,
): boolean {
  return serverNow - window.startedAt < window.durationMs;
}

/** Minutes the window really covers: the whole hour or the time since the start, at least 1. */
export function windowSpanMinutes(
  window: AppMetrics["window"],
  serverNow: number,
): number {
  const covered = Math.min(window.durationMs, serverNow - window.startedAt);
  return Math.max(1, Math.ceil(covered / MINUTE_MS));
}

/** All results in the fixed order of the legend, zeros included. */
export function resultEntries(
  results: AppMetrics["results"],
): { key: ResultKey; count: number }[] {
  return RESULT_KEYS.map((key) => ({ key, count: results[key] }));
}

export function serviceState(available: boolean | null): ServiceState {
  if (available === null) return "unknown";
  return available ? "available" : "unavailable";
}
