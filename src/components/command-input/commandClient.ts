import * as v from "valibot";
import {
  COMMAND_ENDPOINT,
  type CommandRequest,
  type CommandResponse,
  commandResponseSchema,
} from "@/shared/command/commandContract";

/** The whole request (AI and geocoding) has this long; then the user gets the generic error. */
export const COMMAND_TIMEOUT_MS = 10_000;

export type CommandClient = (
  request: CommandRequest,
) => Promise<CommandResponse>;

const LOCAL_ERROR: CommandResponse = { ok: false, error: { code: "error" } };

/** Never rejects: network errors, timeouts and unexpected answers all become the generic error. */
export async function sendCommand(
  request: CommandRequest,
  { timeoutMs = COMMAND_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<CommandResponse> {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(COMMAND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const parsed = v.safeParse(commandResponseSchema, await response.json());
    return parsed.success ? parsed.output : LOCAL_ERROR;
  } catch {
    return LOCAL_ERROR;
  } finally {
    window.clearTimeout(timerId);
  }
}
