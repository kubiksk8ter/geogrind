import type { MetricsSnapshot } from "@/shared/metricsContract";
import type { LoadMetrics } from "./metricsClient";

/** Within the 15 s the spec allows for a new figure to show; also the command cooldown. */
export const POLL_INTERVAL_MS = 10_000;

export interface MetricsPollState {
  /** The last snapshot that arrived and passed validation. */
  snapshot: MetricsSnapshot | null;
  /** Server time minus device time at the last answer, for countdowns. */
  clockOffsetMs: number;
  /** The last fetch failed; the snapshot may be out of date. */
  failed: boolean;
}

export const INITIAL_POLL_STATE: MetricsPollState = {
  snapshot: null,
  clockOffsetMs: 0,
  failed: false,
};

export interface MetricsPollerOptions {
  load: LoadMetrics;
  onState(state: MetricsPollState): void;
  intervalMs?: number;
  now?: () => number;
  page?: Pick<
    Document,
    "visibilityState" | "addEventListener" | "removeEventListener"
  >;
}

/**
 * Loads at once and then at an interval, but only while the page is visible; becoming visible
 * loads at once. Never runs two loads together. A failure keeps the snapshot and the next tick
 * is the retry. Returns the function that stops it.
 */
export function startMetricsPoller({
  load,
  onState,
  intervalMs = POLL_INTERVAL_MS,
  now = Date.now,
  page = document,
}: MetricsPollerOptions): () => void {
  let state = INITIAL_POLL_STATE;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let loading = false;
  let stopped = false;

  const schedule = () => {
    clearTimeout(timerId);
    timerId = setTimeout(tick, intervalMs);
  };

  async function tick() {
    if (stopped || page.visibilityState !== "visible") return;
    schedule();
    if (loading) return;

    loading = true;
    const snapshot = await load();
    loading = false;
    if (stopped) return;

    state = snapshot
      ? { snapshot, clockOffsetMs: snapshot.serverNow - now(), failed: false }
      : { ...state, failed: true };
    onState(state);
  }

  const onVisibilityChange = () => {
    if (page.visibilityState === "visible") void tick();
    else clearTimeout(timerId);
  };

  page.addEventListener("visibilitychange", onVisibilityChange);
  void tick();

  return () => {
    stopped = true;
    clearTimeout(timerId);
    page.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
