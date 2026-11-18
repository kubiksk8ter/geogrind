import { createCommandHandler } from "@/server/command/commandHandler";
import { createServices } from "@/server/command/services";
import { getEnv } from "@/server/config/env";
import { createCommandMeasurement } from "@/server/metrics/app/commandMeasurement";
import { sharedCommandWindow } from "@/server/metrics/app/commandWindow";
import { createStateStore } from "@/server/state/createStateStore";
import { REQUEST_BUDGET_MS } from "@/server/state/rules";
import { systemClock } from "@/server/state/types";

const handler = createCommandHandler({
  loadEnv: getEnv,
  createServices,
  createRequestSignal: () => AbortSignal.timeout(REQUEST_BUDGET_MS),
  log: (entry) => console.info("[command]", JSON.stringify(entry)),
  // Outside createServices, so commands that fail before the services exist are counted too.
  measurement: createCommandMeasurement({
    window: sharedCommandWindow(),
    openStore: () => createStateStore(getEnv()),
    clock: systemClock,
    log: (code) => console.warn("[metrics]", code),
  }),
});

// Every method goes to the handler, so a wrong method gets the same answer shape as any failure.
export const POST = handler;
export const GET = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
