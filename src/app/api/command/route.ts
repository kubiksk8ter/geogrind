import { createCommandHandler } from "@/server/command/commandHandler";
import { createServices } from "@/server/command/services";
import { getEnv } from "@/server/config/env";
import { REQUEST_BUDGET_MS } from "@/server/state/rules";

const handler = createCommandHandler({
  loadEnv: getEnv,
  createServices,
  createRequestSignal: () => AbortSignal.timeout(REQUEST_BUDGET_MS),
  log: (entry) => console.info("[command]", JSON.stringify(entry)),
});

// Every method goes to the handler, so a wrong method gets the same answer shape as any failure.
export const POST = handler;
export const GET = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
