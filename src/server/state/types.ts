import * as v from "valibot";
import {
  noResults,
  type ResultKey,
  resultCountsSchema,
} from "@/shared/metricsContract";

export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

const timestamp = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const counter = timestamp;

export type ResultCounts = Record<ResultKey, number>;

export const stateDataSchema = v.strictObject({
  version: v.literal(1),
  /** UTC day ("YYYY-MM-DD") the counter belongs to. */
  daily: v.strictObject({
    day: v.string(),
    count: counter,
    /** Tokens of the day; optional so that a file written before they existed stays valid. */
    tokens: v.optional(counter, 0),
    /** Processed commands of the day by result; optional for the same reason. */
    results: v.optional(resultCountsSchema, noResults),
  }),
  aiBlockedUntil: v.optional(timestamp),
  clients: v.record(
    v.string(),
    v.strictObject({
      hits: v.array(timestamp),
      cooldownUntil: v.optional(timestamp),
      inflightUntil: v.optional(timestamp),
    }),
  ),
});
export type StateData = v.InferOutput<typeof stateDataSchema>;

export const EMPTY_STATE: StateData = {
  version: 1,
  daily: { day: "", count: 0, tokens: 0, results: noResults() },
  clients: {},
};

export class StateUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StateUnavailableError";
  }
}

export interface StateStore {
  /** Atomic read-modify-write; throws StateUnavailableError on any storage problem. */
  transact<T>(
    fn: (state: StateData) => { next: StateData; result: T },
  ): Promise<T>;
  /** The current state without a lock or a write; throws StateUnavailableError like transact. */
  read(): Promise<StateData>;
}
