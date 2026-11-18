import "server-only";
import type { AppEnv } from "../config/env";
import { createStateStore } from "../state/createStateStore";
import { systemClock } from "../state/types";
import { sharedAiFigures } from "./ai/aiFigures";
import { sharedCommandWindow } from "./app/commandWindow";
import { sharedNominatimStatus } from "./app/serviceStatus";
import type { MetricsServices } from "./metricsHandler";

export function createMetricsServices(env: AppEnv): MetricsServices {
  return {
    store: createStateStore(env),
    figures: sharedAiFigures(),
    commandWindow: sharedCommandWindow(),
    nominatim: sharedNominatimStatus(),
    clock: systemClock,
  };
}
