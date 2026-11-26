import type { LimitFigure } from "@/shared/metricsContract";

export type LimitView =
  /** The reset time has passed: the old figure must not be shown as current. */
  | { kind: "renewed" }
  | {
      kind: "current";
      remaining: number | null;
      /** A bar needs both figures and a range; unknown values never become 0 or 100 %. */
      bar: { remaining: number; limit: number } | null;
      /** Null when the reset time is unknown. */
      resetInMs: number | null;
    };

export const UNKNOWN_LIMIT: LimitFigure = {
  remaining: null,
  limit: null,
  resetsAt: null,
};

/** `now` is the server's time, already corrected for the device clock. */
export function limitView(figure: LimitFigure, now: number): LimitView {
  const { remaining, limit, resetsAt } = figure;
  if (resetsAt !== null && resetsAt <= now) return { kind: "renewed" };

  return {
    kind: "current",
    remaining,
    bar:
      remaining !== null && limit !== null && limit > 0
        ? { remaining, limit }
        : null,
    resetInMs: resetsAt === null ? null : resetsAt - now,
  };
}
