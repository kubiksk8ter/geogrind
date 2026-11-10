import type { Clock } from "../state/types";

/**
 * Runs tasks one at a time, each starting at least `intervalMs` after the previous start
 * (Nominatim allows one request per second for the whole application).
 */
export class RequestSpacer {
  private tail: Promise<void> = Promise.resolve();
  private lastStart = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly intervalMs: number,
    private readonly clock: Clock,
    private readonly sleep: (
      milliseconds: number,
      signal: AbortSignal,
    ) => Promise<void>,
  ) {}

  run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    const result = this.tail.then(async () => {
      signal.throwIfAborted();
      const wait = this.lastStart + this.intervalMs - this.clock.now();
      if (wait > 0) await this.sleep(wait, signal);
      this.lastStart = this.clock.now();
      return task();
    });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

/** Sleep that ends early, with the abort reason, when the signal aborts. */
export function abortableSleep(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
