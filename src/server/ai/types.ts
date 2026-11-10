import type { ModelOutput } from "@/shared/command/actions";
import type { Locale } from "@/shared/command/commandContract";

export type AiResult =
  | { kind: "output"; output: ModelOutput }
  /** The provider refused because a quota or rate limit is used up (HTTP 429). */
  | { kind: "quota_exhausted"; retryAfterSeconds?: number };

export interface AiClient {
  /** Resolves with a result; every other failure (network, 5xx, bad key, bad output) throws. */
  interpret(
    input: { text: string; locale: Locale },
    signal: AbortSignal,
  ): Promise<AiResult>;
}

/** The AI step failed; the message never contains the provider's response. */
export class AiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AiError";
  }
}
