import { getEnv } from "@/server/config/env";
import { createMetricsHandler } from "@/server/metrics/metricsHandler";
import { createMetricsServices } from "@/server/metrics/services";

const handler = createMetricsHandler({
  loadEnv: getEnv,
  createServices: createMetricsServices,
  log: (entry) => console.info("[metrics]", JSON.stringify(entry)),
});

// Every method goes to the handler, so a wrong method gets the same answer shape as any failure.
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
