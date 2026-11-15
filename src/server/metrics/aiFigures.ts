import type { AiMetrics } from "@/shared/metricsContract";
import { type AiAnswer, hasLimitFigure } from "../ai/aiAnswer";

export type LastRequest = NonNullable<AiMetrics["lastRequest"]>;
export type LimitsFigures = NonNullable<AiMetrics["limits"]>;

/** The figures that do not outlive the process: the last request and the latest limits. */
export interface AiFigures {
  update(answer: AiAnswer): void;
  current(): { lastRequest: LastRequest | null; limits: LimitsFigures | null };
}

export class InMemoryAiFigures implements AiFigures {
  private lastRequest: LastRequest | null = null;
  private limits: LimitsFigures | null = null;

  /** The newest answer wins, so answers arriving out of order cannot bring back old figures. */
  update(answer: AiAnswer): void {
    const { receivedAt, usage } = answer;

    if (
      usage &&
      (this.lastRequest === null || receivedAt >= this.lastRequest.at)
    ) {
      this.lastRequest = { at: receivedAt, ...usage };
    }
    // An answer without any limit header (e.g. HTTP 401) must not wipe good figures.
    if (
      hasLimitFigure(answer) &&
      (this.limits === null || receivedAt >= this.limits.receivedAt)
    ) {
      this.limits = { receivedAt, ...answer.limits };
    }
  }

  current() {
    return { lastRequest: this.lastRequest, limits: this.limits };
  }
}

// Bundles may contain this module more than once, so the instance lives on globalThis.
declare global {
  var geogrindAiFigures: AiFigures | undefined;
}

export function sharedAiFigures(): AiFigures {
  globalThis.geogrindAiFigures ??= new InMemoryAiFigures();
  return globalThis.geogrindAiFigures;
}
