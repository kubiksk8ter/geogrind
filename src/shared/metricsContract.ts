import * as v from "valibot";
import type { CommandErrorCode } from "./commandContract";

export const METRICS_ENDPOINT = "/api/metrics";

/** `null` always means "no data"; it is never replaced by 0 or 100 %. */
const count = v.nullable(v.pipe(v.number(), v.safeInteger(), v.minValue(0)));
/** Epoch milliseconds. */
const instant = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

export const limitFigureSchema = v.strictObject({
  remaining: count,
  limit: count,
  /** Absolute time of the reset, from the server's clock. */
  resetsAt: v.nullable(instant),
});
export type LimitFigure = v.InferOutput<typeof limitFigureSchema>;

export const aiMetricsSchema = v.strictObject({
  /** The configured model, shown as is. */
  model: v.string(),
  /** The app's own cap of AI requests per UTC day. */
  dailyCap: v.strictObject({
    used: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
    cap: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
    /** Next UTC midnight. */
    resetsAt: instant,
  }),
  /** Tokens of all users since 00:00 UTC. */
  dailyTokens: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  /** Null until a request with `usage` is known. */
  lastRequest: v.nullable(
    v.strictObject({
      at: instant,
      prompt: count,
      completion: count,
      total: count,
    }),
  ),
  /** The requests limit is per day, the tokens limit per minute; null until a request is known. */
  limits: v.nullable(
    v.strictObject({
      receivedAt: instant,
      requests: limitFigureSchema,
      tokens: limitFigureSchema,
    }),
  ),
});
export type AiMetrics = v.InferOutput<typeof aiMetricsSchema>;

/** Every result a processed command can end with; `invalid_request` is never processed. */
export const RESULT_KEYS = [
  "success",
  "unsupported",
  "not_found",
  "wait",
  "too_many_requests",
  "ai_resting",
  "error",
] as const;
export type ResultKey = (typeof RESULT_KEYS)[number];

// Fails to compile when a command code is added or removed without updating RESULT_KEYS.
type SameKeys<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
type ProcessedResult = Exclude<CommandErrorCode, "invalid_request"> | "success";
true satisfies SameKeys<ResultKey, ProcessedResult>;

const amount = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const span = v.pipe(v.number(), v.safeInteger(), v.minValue(1));

export const resultCountsSchema = v.strictObject({
  success: amount,
  unsupported: amount,
  not_found: amount,
  wait: amount,
  too_many_requests: amount,
  ai_resting: amount,
  error: amount,
} satisfies Record<ResultKey, typeof amount>);

/** Zero for every result; a fresh object each call, so callers may change it. */
export function noResults(): Record<ResultKey, number> {
  return Object.fromEntries(RESULT_KEYS.map((key) => [key, 0])) as Record<
    ResultKey,
    number
  >;
}

export const appMetricsSchema = v.strictObject({
  /** Commands of today (UTC) by result; kept across restarts. */
  results: resultCountsSchema,
  /** The in-memory hour window; it starts empty at `startedAt` (the server start). */
  window: v.strictObject({
    startedAt: instant,
    durationMs: span,
    bucketMs: span,
  }),
  load: v.strictObject({
    lastMinute: amount,
    /** Null until a command was recorded after the start. */
    lastHour: v.nullable(amount),
    activeClients: v.nullable(amount),
    inProgress: amount,
  }),
  /** Null when no command with a latency is in the window. */
  latency: v.nullable(
    v.strictObject({
      count: span,
      medianMs: amount,
      p95Ms: amount,
      /** Bucket medians, oldest first; null is an empty bucket (a gap, not 0). */
      series: v.array(v.nullable(amount)),
    }),
  ),
  /** Null means unknown (no geocoder call since the start). */
  services: v.strictObject({ nominatim: v.nullable(v.boolean()) }),
});
export type AppMetrics = v.InferOutput<typeof appMetricsSchema>;

export const metricsSnapshotSchema = v.strictObject({
  /** The server's clock, so the browser can correct countdowns for a wrong device clock. */
  serverNow: instant,
  ai: aiMetricsSchema,
  /** The application itself; a further source becomes one more sibling group. */
  app: appMetricsSchema,
});
export type MetricsSnapshot = v.InferOutput<typeof metricsSnapshotSchema>;

export const METRICS_ERROR_CODES = ["invalid_request", "error"] as const;
export type MetricsErrorCode = (typeof METRICS_ERROR_CODES)[number];

export const metricsResponseSchema = v.variant("ok", [
  v.strictObject({ ok: v.literal(true), metrics: metricsSnapshotSchema }),
  v.strictObject({
    ok: v.literal(false),
    error: v.strictObject({ code: v.picklist(METRICS_ERROR_CODES) }),
  }),
]);
export type MetricsResponse = v.InferOutput<typeof metricsResponseSchema>;
