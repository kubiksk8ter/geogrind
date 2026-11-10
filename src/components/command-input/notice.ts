import type { CommandErrorCode } from "@/shared/command/commandContract";

/** What the message area shows (and announces) right now. */
export type Notice =
  | { kind: "loading" }
  | {
      kind: "failure";
      code: Exclude<CommandErrorCode, "wait">;
      retryAfterSeconds?: number;
      resetAt?: string;
    }
  /** Spoken to assistive technology only; the visible countdown is a separate element. */
  | { kind: "pausedStart"; seconds: number }
  | { kind: "resumed" };

/** How long a failure or an announcement stays; loading stays until the answer arrives. */
export const NOTICE_DURATION_MS = 8_000;

export const isTransient = (notice: Notice) => notice.kind !== "loading";

export type NoticeSeverity = "info" | "warning" | "error";

/**
 * Warning: the user can fix or wait it out (unsupported or unknown place, bad text, rate limit).
 * Error: the service cannot do it right now (service failure, AI resting).
 */
export function noticeSeverity(notice: Notice): NoticeSeverity {
  if (notice.kind !== "failure") return "info";
  switch (notice.code) {
    case "unsupported":
    case "not_found":
    case "invalid_request":
    case "too_many_requests":
      return "warning";
    case "ai_resting":
    case "error":
      return "error";
  }
}
