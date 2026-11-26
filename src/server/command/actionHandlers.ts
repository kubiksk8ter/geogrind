import type { CommandResult, ModelOutput } from "@/shared/actions";
import type { Geocoder } from "../geocoding/types";

export type ActionOutcome =
  | { kind: "success"; result: CommandResult }
  | { kind: "not_found" };

export type ActionOutput = Exclude<ModelOutput, { action: "unsupported" }>;

interface ActionContext {
  geocoder: Geocoder;
  signal: AbortSignal;
}

function unreachable(_action: never): never {
  throw new Error("Unhandled action");
}

/**
 * Executes an action. The switch is exhaustive: a new action in the registry does not compile
 * until it is handled here.
 */
export async function runAction(
  output: ActionOutput,
  { geocoder, signal }: ActionContext,
): Promise<ActionOutcome> {
  switch (output.action) {
    case "zoom_to_place": {
      const found = await geocoder.find(output.place, signal);
      return found
        ? {
            kind: "success",
            result: {
              action: output.action,
              bounds: found.bounds,
              ...(found.highlight && { highlight: found.highlight }),
            },
          }
        : { kind: "not_found" };
    }
    default:
      return unreachable(output.action);
  }
}
