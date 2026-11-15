import type { AiMetrics, MetricsSnapshot } from "@/shared/metricsContract";

export const SERVER_NOW = Date.UTC(2026, 10, 13, 12, 0, 0);

/** A snapshot with everything known; tests override what they care about. */
export function makeSnapshot(
  ai: Partial<AiMetrics> = {},
  serverNow = SERVER_NOW,
): MetricsSnapshot {
  return {
    serverNow,
    ai: {
      model: "test-model",
      dailyCap: { used: 37, cap: 500, resetsAt: Date.UTC(2026, 10, 14) },
      dailyTokens: 270,
      lastRequest: { at: serverNow, prompt: 120, completion: 30, total: 150 },
      limits: {
        receivedAt: serverNow,
        requests: {
          remaining: 480,
          limit: 500,
          resetsAt: serverNow + 179_560,
        },
        tokens: {
          remaining: 6000,
          limit: 8000,
          resetsAt: serverNow + 7_660,
        },
      },
      ...ai,
    },
  };
}
