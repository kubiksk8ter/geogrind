import * as v from "valibot";
import { routing } from "@/i18n/routing";
import { commandResultSchema } from "./actions";
import { isCleanCommandText } from "./text";

export type { Locale } from "@/i18n/routing";

export const commandRequestSchema = v.strictObject({
  text: v.pipe(v.string(), v.check(isCleanCommandText)),
  locale: v.picklist(routing.locales),
});
export type CommandRequest = v.InferOutput<typeof commandRequestSchema>;

export const COMMAND_ERROR_CODES = [
  "invalid_request",
  "unsupported",
  "not_found",
  "wait",
  "too_many_requests",
  "ai_resting",
  "error",
] as const;
export type CommandErrorCode = (typeof COMMAND_ERROR_CODES)[number];

const seconds = v.pipe(v.number(), v.integer(), v.minValue(0));

export const commandResponseSchema = v.variant("ok", [
  v.strictObject({
    ok: v.literal(true),
    result: commandResultSchema,
    cooldownSeconds: seconds,
  }),
  v.strictObject({
    ok: v.literal(false),
    error: v.strictObject({
      code: v.picklist(COMMAND_ERROR_CODES),
      retryAfterSeconds: v.optional(seconds),
      /** ISO timestamp of the next daily reset (`ai_resting` only). */
      resetAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
      /** Present when the command was processed (even unsuccessfully) and started the cooldown. */
      cooldownSeconds: v.optional(seconds),
    }),
  }),
]);
export type CommandResponse = v.InferOutput<typeof commandResponseSchema>;

export const COMMAND_ENDPOINT = "/api/command";
