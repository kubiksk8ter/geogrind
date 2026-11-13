import type {
  CommandErrorCode,
  CommandResponse,
} from "@/shared/commandContract";

/** An answer before it becomes an HTTP response; `code` is also what gets logged. */
export interface PendingResponse {
  status: number;
  body: CommandResponse;
  retryAfterSeconds?: number;
}

export interface FailureDetails {
  retryAfterSeconds?: number;
  resetAt?: number;
  cooldownSeconds?: number;
}

const STATUS: Record<CommandErrorCode, number> = {
  invalid_request: 400,
  unsupported: 200,
  not_found: 200,
  wait: 429,
  too_many_requests: 429,
  ai_resting: 503,
  error: 500,
};

export function failure(
  code: CommandErrorCode,
  { retryAfterSeconds, resetAt, cooldownSeconds }: FailureDetails = {},
  status: number = STATUS[code],
): PendingResponse {
  return {
    status,
    retryAfterSeconds,
    body: {
      ok: false,
      error: {
        code,
        ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
        ...(resetAt !== undefined && {
          resetAt: new Date(resetAt).toISOString(),
        }),
        ...(cooldownSeconds !== undefined && { cooldownSeconds }),
      },
    },
  };
}

export function responseCode(pending: PendingResponse): string {
  return pending.body.ok ? "ok" : pending.body.error.code;
}

/** Same headers for every answer: no caching, no permissive cross-origin headers. */
export function toResponse(pending: PendingResponse): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (pending.status === 405) headers.set("Allow", "POST");
  if (pending.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(pending.retryAfterSeconds));
  }
  return Response.json(pending.body, { status: pending.status, headers });
}
