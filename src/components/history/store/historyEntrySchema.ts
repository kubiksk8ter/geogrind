import * as v from "valibot";
import { commandResultSchema } from "@/shared/actions";
import { isCleanCommandText } from "@/shared/text";

export const MAX_HISTORY_ENTRIES = 50;

/** The same shape and ranges as a server answer, because stored data is trusted no more. */
export const historyEntrySchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  /** Epoch milliseconds of the moment the command succeeded. */
  at: v.pipe(
    v.number(),
    v.check((at) => Number.isFinite(new Date(at).getTime())),
  ),
  /** The normalised text the user typed. */
  text: v.pipe(v.string(), v.check(isCleanCommandText)),
  result: commandResultSchema,
});
export type HistoryEntry = v.InferOutput<typeof historyEntrySchema>;
