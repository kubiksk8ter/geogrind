import "server-only";
import type { AppMetrics, ResultKey } from "@/shared/metricsContract";
import { type Clock, systemClock } from "../../state/types";
import type { CommandMeasurement } from "./commandMeasurement";

export const WINDOW_DURATION_MS = 60 * 60_000;
export const WINDOW_BUCKET_MS = 5 * 60_000;
const LAST_MINUTE_MS = 60_000;
/** Far above what the rate limits let through in an hour for a demo, and a few hundred KB at most. */
const DEFAULT_CAPACITY = 10_000;

/** Instant rejections never reach the AI and would pull the latency down. */
const WITHOUT_LATENCY: ReadonlySet<ResultKey> = new Set([
  "wait",
  "too_many_requests",
]);

interface WindowRecord {
  at: number;
  durationMs: number;
  result: ResultKey;
  /** The client's pseudonym as the limits store it, never the raw id. */
  client: string | null;
}

export type WindowSummary = {
  window: AppMetrics["window"];
  load: Omit<AppMetrics["load"], "inProgress">;
  latency: AppMetrics["latency"];
};

export interface CommandWindowOptions {
  clock?: Clock;
  capacity?: number;
}

/** Nearest rank: the smallest value with at least `p` of all values at or below it. */
function percentile(sorted: readonly number[], p: number): number {
  const index = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[index] ?? 0;
}

const median = (sorted: readonly number[]) => percentile(sorted, 0.5);
const ascending = (a: number, b: number) => a - b;

/**
 * The last hour of processed commands in a fixed-size ring buffer: memory stays bounded whatever
 * the traffic; when full, the oldest record is overwritten. Empty after a restart.
 */
export class CommandWindow {
  private readonly clock: Clock;
  private readonly capacity: number;
  private readonly records: WindowRecord[] = [];
  private next = 0;
  private readonly startedAt: number;

  constructor({
    clock = systemClock,
    capacity = DEFAULT_CAPACITY,
  }: CommandWindowOptions = {}) {
    this.clock = clock;
    this.capacity = capacity;
    this.startedAt = clock.now();
  }

  record({ result, durationMs, clientId }: CommandMeasurement): void {
    const entry: WindowRecord = {
      at: this.clock.now(),
      durationMs: Math.max(0, Math.round(durationMs)),
      result,
      // Pseudonymised by the command handler with the shared key, so it is not hashed again.
      client: clientId,
    };
    if (this.records.length < this.capacity) {
      this.records.push(entry);
    } else {
      this.records[this.next] = entry;
    }
    this.next = (this.next + 1) % this.capacity;
  }

  summary(): WindowSummary {
    const now = this.clock.now();
    const ageOf = (record: WindowRecord) => Math.max(0, now - record.at);
    const live = this.records.filter(
      (record) => ageOf(record) < WINDOW_DURATION_MS,
    );
    const recordedSinceStart = this.records.length > 0;

    return {
      window: {
        startedAt: this.startedAt,
        durationMs: WINDOW_DURATION_MS,
        bucketMs: WINDOW_BUCKET_MS,
      },
      load: {
        lastMinute: live.filter((record) => ageOf(record) < LAST_MINUTE_MS)
          .length,
        lastHour: recordedSinceStart ? live.length : null,
        activeClients: recordedSinceStart ? countClients(live) : null,
      },
      latency: latencyOf(
        live.filter((record) => !WITHOUT_LATENCY.has(record.result)),
        ageOf,
      ),
    };
  }
}

function countClients(records: readonly WindowRecord[]): number {
  const clients = new Set<string>();
  for (const { client } of records) {
    if (client !== null) clients.add(client);
  }
  return clients.size;
}

function latencyOf(
  records: readonly WindowRecord[],
  ageOf: (record: WindowRecord) => number,
): AppMetrics["latency"] {
  if (records.length === 0) return null;

  const bucketCount = WINDOW_DURATION_MS / WINDOW_BUCKET_MS;
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
  for (const record of records) {
    // Oldest bucket first; the newest ends at `now`.
    const index =
      bucketCount - 1 - Math.floor(ageOf(record) / WINDOW_BUCKET_MS);
    buckets[index]?.push(record.durationMs);
  }

  const sorted = records.map((record) => record.durationMs).sort(ascending);
  return {
    count: sorted.length,
    medianMs: median(sorted),
    p95Ms: percentile(sorted, 0.95),
    series: buckets.map((bucket) =>
      bucket.length === 0 ? null : median(bucket.sort(ascending)),
    ),
  };
}

// Bundles may contain this module more than once, so the instance lives on globalThis.
declare global {
  var geogrindCommandWindow: CommandWindow | undefined;
}

export function sharedCommandWindow(): CommandWindow {
  globalThis.geogrindCommandWindow ??= new CommandWindow();
  return globalThis.geogrindCommandWindow;
}
