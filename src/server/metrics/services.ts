import "server-only";
import type { AppEnv } from "../config/env";
import { createStateStore } from "../state/createStateStore";
import { systemClock } from "../state/types";
import { sharedAiFigures } from "./aiFigures";
import type { MetricsServices } from "./metricsHandler";

export function createMetricsServices(env: AppEnv): MetricsServices {
  return {
    store: createStateStore(env),
    figures: sharedAiFigures(),
    clock: systemClock,
  };
}
