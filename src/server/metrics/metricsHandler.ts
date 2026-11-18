import "server-only";
import type { MetricsResponse } from "@/shared/metricsContract";
import type { AppEnv } from "../config/env";
import type { Clock, StateStore } from "../state/types";
import type { AiFigures } from "./ai/aiFigures";
import type { CommandWindow } from "./app/commandWindow";
import type { ServiceStatus } from "./app/serviceStatus";
import { guardMetricsRequest } from "./metricsGuard";
import { buildSnapshot } from "./metricsSnapshot";

/** Only what reading needs: no AI client, geocoder or limit counters can be reached from here. */
export interface MetricsServices {
  store: StateStore;
  figures: AiFigures;
  /** Read only through `summary`; nothing here records a command. */
  commandWindow: Pick<CommandWindow, "summary">;
  nominatim: Pick<ServiceStatus, "current">;
  clock: Clock;
}

export interface MetricsHandlerDeps {
  loadEnv(): AppEnv;
  createServices(env: AppEnv): MetricsServices;
  /** Receives the result code and duration only; called for failures. */
  log(entry: { code: string; durationMs: number; cause?: string }): void;
}

type Outcome = { status: 200 | 403 | 405 | 500; body: MetricsResponse };

const failure = (
  code: "invalid_request" | "error",
  status: 403 | 405 | 500,
): Outcome => ({ status, body: { ok: false, error: { code } } });

function causeOf(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

export function createMetricsHandler(deps: MetricsHandlerDeps) {
  async function process(request: Request): Promise<Outcome> {
    const env = deps.loadEnv();
    const guard = guardMetricsRequest(request, env.appOrigins);
    if (!guard.ok) return failure("invalid_request", guard.status);

    const { store, figures, commandWindow, nominatim, clock } =
      deps.createServices(env);
    const metrics = buildSnapshot({
      state: await store.read(),
      figures: figures.current(),
      window: commandWindow.summary(),
      nominatim: nominatim.current(),
      model: env.groqModel,
      dailyCap: env.dailyCap,
      now: clock.now(),
    });
    return { status: 200, body: { ok: true, metrics } };
  }

  return async function handle(request: Request): Promise<Response> {
    const started = performance.now();
    let cause: string | undefined;
    let outcome: Outcome;
    try {
      outcome = await process(request);
    } catch (error) {
      cause = causeOf(error);
      outcome = failure("error", 500);
    }

    if (!outcome.body.ok) {
      deps.log({
        code: outcome.body.error.code,
        durationMs: Math.round(performance.now() - started),
        ...(cause !== undefined && { cause }),
      });
    }
    // No caching and no permissive cross-origin headers, whatever the outcome.
    const headers = new Headers({ "Cache-Control": "no-store" });
    if (outcome.status === 405) headers.set("Allow", "GET");
    return Response.json(outcome.body, { status: outcome.status, headers });
  };
}
