import "server-only";
import * as v from "valibot";
import {
  MODEL_OUTPUT_JSON_SCHEMA,
  modelResponseSchema,
} from "@/shared/command/actions";
import { SYSTEM_PROMPT, userMessage } from "./prompt";
import { type AiClient, AiError, type AiResult } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Reasoning tokens count against this limit; the answer itself is tiny.
const MAX_COMPLETION_TOKENS = 512;

const completionSchema = v.object({
  choices: v.pipe(
    v.array(
      v.object({
        finish_reason: v.nullish(v.string()),
        message: v.object({ content: v.nullish(v.string()) }),
      }),
    ),
    v.minLength(1),
  ),
});

export interface GroqClientOptions {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
}

export class GroqClient implements AiClient {
  constructor(private readonly options: GroqClientOptions) {}

  async interpret(
    input: Parameters<AiClient["interpret"]>[0],
    signal: AbortSignal,
  ): Promise<AiResult> {
    const send = this.options.fetch ?? fetch;
    const response = await send(GROQ_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.requestBody(input)),
    });

    if (response.status === 429) {
      return {
        kind: "quota_exhausted",
        retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
      };
    }
    if (!response.ok) throw new AiError(`Groq answered ${response.status}`);

    return { kind: "output", output: await readOutput(response) };
  }

  private requestBody({ text, locale }: Parameters<AiClient["interpret"]>[0]) {
    return {
      model: this.options.model,
      temperature: 0,
      stream: false,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      reasoning_effort: "low",
      include_reasoning: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "map_command",
          strict: true,
          schema: MODEL_OUTPUT_JSON_SCHEMA,
        },
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage(text, locale) },
      ],
    };
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  const seconds = Number(header);
  return header !== null && Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : undefined;
}

async function readOutput(response: Response) {
  const body = v.safeParse(completionSchema, await response.json());
  const choice = body.success ? body.output.choices[0] : undefined;
  if (choice?.finish_reason !== "stop" || !choice.message.content) {
    throw new AiError("Groq answer is incomplete");
  }

  const parsed = v.safeParse(
    modelResponseSchema,
    parseJson(choice.message.content),
  );
  if (!parsed.success) throw new AiError("Groq output has an invalid shape");
  return parsed.output.output;
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new AiError("Groq output is not JSON");
  }
}
