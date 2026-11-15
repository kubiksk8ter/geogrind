import * as v from "valibot";
import {
  METRICS_ENDPOINT,
  type MetricsSnapshot,
  metricsResponseSchema,
} from "@/shared/metricsContract";

export const METRICS_TIMEOUT_MS = 5_000;

/** Resolves with the snapshot, or null for any failure; never rejects. */
export type LoadMetrics = () => Promise<MetricsSnapshot | null>;

export const fetchMetrics: LoadMetrics = async () => {
  try {
    const response = await fetch(METRICS_ENDPOINT, {
      cache: "no-store",
      signal: AbortSignal.timeout(METRICS_TIMEOUT_MS),
    });
    const parsed = v.safeParse(metricsResponseSchema, await response.json());
    return parsed.success && parsed.output.ok ? parsed.output.metrics : null;
  } catch {
    return null;
  }
};
