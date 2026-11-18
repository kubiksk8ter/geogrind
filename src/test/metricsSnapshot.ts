import type {
  AiMetrics,
  AppMetrics,
  MetricsSnapshot,
} from "@/shared/metricsContract";

export const SERVER_NOW = Date.UTC(2026, 10, 13, 12, 0, 0);

const HOUR_MS = 3_600_000;
const BUCKET_MS = 300_000;

/** Application figures with everything known and a full hour window; tests override parts. */
export function makeAppMetrics(
  app: Partial<AppMetrics> = {},
  serverNow = SERVER_NOW,
): AppMetrics {
  return {
    results: {
      success: 6,
      unsupported: 0,
      not_found: 2,
      wait: 1,
      too_many_requests: 0,
      ai_resting: 0,
      error: 1,
    },
    window: {
      startedAt: serverNow - 2 * HOUR_MS,
      durationMs: HOUR_MS,
      bucketMs: BUCKET_MS,
    },
    load: { lastMinute: 1, lastHour: 10, activeClients: 3, inProgress: 0 },
    latency: {
      count: 8,
      medianMs: 820,
      p95Ms: 1450,
      series: [
        null,
        null,
        700,
        null,
        900,
        820,
        null,
        null,
        1450,
        null,
        760,
        null,
      ],
    },
    services: { nominatim: true },
    ...app,
  };
}

/** A snapshot with everything known; tests override what they care about. */
export function makeSnapshot(
  ai: Partial<AiMetrics> = {},
  serverNow = SERVER_NOW,
  app: Partial<AppMetrics> = {},
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
    app: makeAppMetrics(app, serverNow),
  };
}
