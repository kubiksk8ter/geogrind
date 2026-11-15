import * as v from "valibot";

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

export const metricsSnapshotSchema = v.strictObject({
  /** The server's clock, so the browser can correct countdowns for a wrong device clock. */
  serverNow: instant,
  /** A further source (application load) becomes a sibling group. */
  ai: aiMetricsSchema,
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
