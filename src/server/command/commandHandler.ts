import "server-only";
import * as v from "valibot";
import {
  type CommandRequest,
  commandRequestSchema,
} from "@/shared/commandContract";
import type { ResultKey } from "@/shared/metricsContract";
import type { AiClient } from "../ai/types";
import type { AppEnv } from "../config/env";
import type { Geocoder } from "../geocoding/types";
import type { CommandMeasurementRecorder } from "../metrics/app/commandMeasurement";
import type { Pseudonymizer } from "../privacy/clientKeyring";
import type { CommandLimits } from "../state/limits";
import { runAction } from "./actionHandlers";
import { resolveClientId } from "./clientIp";
import {
  failure,
  type PendingResponse,
  responseCode,
  toResponse,
} from "./commandResponse";
import { guardRequest } from "./requestGuard";

export interface CommandServices {
  ai: AiClient;
  geocoder: Geocoder;
  limits: CommandLimits;
}

export interface CommandHandlerDeps {
  loadEnv(): AppEnv;
  createServices(env: AppEnv): CommandServices;
  /** Aborts when the time budget of one request is used up. */
  createRequestSignal(): AbortSignal;
  /** Receives the result code and duration only; never request content. */
  log(entry: { code: string; durationMs: number; cause?: string }): void;
  /** Told once per processed command (not for `invalid_request`); never throws. */
  measurement: CommandMeasurementRecorder;
  /** Applied right after the client id is resolved; nothing after it sees the raw id. */
  pseudonymize: Pseudonymizer;
}

/** What `process` learnt on the way, for the log line and the measurement. */
interface Report {
  cause?: string;
  /** The client's pseudonym, never the raw id. */
  clientId?: string;
}

/** `invalid_request` was rejected before processing, so it is not measured. */
function measuredResult(pending: PendingResponse): ResultKey | null {
  if (pending.body.ok) return "success";
  const { code } = pending.body.error;
  return code === "invalid_request" ? null : code;
}

/** Names the failure for the log; the message is never logged because it could hold content. */
function causeOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    return String(error.name);
  }
  return "unknown";
}

class MissingClientAddressError extends Error {
  name = "MissingClientAddressError";
}

export function createCommandHandler(deps: CommandHandlerDeps) {
  async function process(
    request: Request,
    report: Report,
  ): Promise<PendingResponse> {
    const env = deps.loadEnv();

    const guard = await guardRequest(request, env.appOrigins);
    if (!guard.ok) return failure("invalid_request", {}, guard.status);

    const rawClientId = resolveClientId(request.headers, env.clientIpHeader);
    if (!rawClientId) throw new MissingClientAddressError();
    // A failure here ends in the generic error; the raw id is never a fallback.
    const clientId = deps.pseudonymize(rawClientId);
    report.clientId = clientId;

    const services = deps.createServices(env);
    const hit = await services.limits.recordHit(clientId);
    if (hit.kind === "limited") {
      return failure("too_many_requests", {
        retryAfterSeconds: hit.retryAfterSeconds,
      });
    }

    const command = parseRequest(guard.body);
    if (!command) return failure("invalid_request");

    const admission = await services.limits.admit(clientId);
    switch (admission.kind) {
      case "wait":
        return failure("wait", {
          retryAfterSeconds: admission.retryAfterSeconds,
        });
      case "busy":
        return failure("too_many_requests", {
          retryAfterSeconds: admission.retryAfterSeconds,
        });
      case "ai_resting":
        return failure("ai_resting", { resetAt: admission.resetAt });
      case "admitted":
        break;
    }

    // From here on the in-flight mark is set and must be cleared on every path.
    try {
      return await interpretAndRun(command, services, clientId);
    } catch (error) {
      // An admitted attempt that failed still started the cooldown, like any other attempt.
      report.cause = causeOf(error);
      const cooldown = await services.limits
        .complete(clientId)
        .catch(() => undefined);
      return failure("error", { cooldownSeconds: cooldown?.cooldownSeconds });
    }
  }

  async function interpretAndRun(
    command: CommandRequest,
    { ai, geocoder, limits }: CommandServices,
    clientId: string,
  ): Promise<PendingResponse> {
    const signal = deps.createRequestSignal();
    const result = await ai.interpret(command, signal);

    if (result.kind === "quota_exhausted") {
      const { aiBlockedUntil } = await limits.release(clientId, {
        retryAfterSeconds: result.retryAfterSeconds,
      });
      return failure("ai_resting", { resetAt: aiBlockedUntil });
    }
    if (result.output.action === "unsupported") {
      const { cooldownSeconds } = await limits.complete(clientId);
      return failure("unsupported", { cooldownSeconds });
    }

    const outcome = await runAction(result.output, {
      geocoder,
      signal,
    });
    if (outcome.kind === "not_found") {
      const { cooldownSeconds } = await limits.complete(clientId);
      return failure("not_found", { cooldownSeconds });
    }

    const { cooldownSeconds } = await limits.complete(clientId);
    return {
      status: 200,
      body: { ok: true, result: outcome.result, cooldownSeconds },
    };
  }

  return async function handle(request: Request): Promise<Response> {
    const started = performance.now();
    const report: Report = {};
    let pending: PendingResponse;
    try {
      pending = await process(request, report);
    } catch (error) {
      report.cause = causeOf(error);
      pending = failure("error");
    }
    const { cause, clientId } = report;
    const durationMs = Math.round(performance.now() - started);
    deps.log({
      code: responseCode(pending),
      durationMs,
      ...(cause !== undefined && { cause }),
    });
    reportMeasurement(pending, durationMs, clientId ?? null);
    return toResponse(pending);
  };

  function reportMeasurement(
    pending: PendingResponse,
    durationMs: number,
    clientId: string | null,
  ) {
    const result = measuredResult(pending);
    if (result === null) return;
    try {
      deps.measurement({ result, durationMs, clientId });
    } catch {
      // Collecting metrics must never change the answer to a command.
    }
  }
}

function parseRequest(body: string) {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const result = v.safeParse(commandRequestSchema, json);
  return result.success ? result.output : null;
}
