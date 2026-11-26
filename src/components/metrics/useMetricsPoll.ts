import { useEffect, useState } from "react";
import { fetchMetrics, type LoadMetrics } from "./metricsClient";
import {
  INITIAL_POLL_STATE,
  type MetricsPollState,
  startMetricsPoller,
} from "./metricsPoller";

/** The latest figures while the component is mounted; polling pauses with a hidden page. */
export function useMetricsPoll(load: LoadMetrics = fetchMetrics) {
  const [state, setState] = useState<MetricsPollState>(INITIAL_POLL_STATE);

  useEffect(() => startMetricsPoller({ load, onState: setState }), [load]);

  return state;
}
