import * as v from "valibot";

/** What one Groq HTTP answer tells about usage and limits. Numbers and times only. */
export interface AiAnswer {
  /** Epoch ms, from the server's clock. */
  receivedAt: number;
  usage: {
    prompt: number | null;
    completion: number | null;
    total: number | null;
  } | null;
  limits: {
    /** Per day. */
    requests: RateLimitFigure;
    /** Per minute. */
    tokens: RateLimitFigure;
  };
}

export interface RateLimitFigure {
  remaining: number | null;
  limit: number | null;
  /** Absolute epoch ms. */
  resetsAt: number | null;
}

/** Must not throw; the client guards against it anyway. */
export type AiObserver = (answer: AiAnswer) => void;

// A sane bound: far above any real quota, far below what could break arithmetic or the UI.
const MAX_COUNT = 1_000_000_000_000;
const MAX_DURATION_SECONDS = 366 * 24 * 60 * 60;

const UNIT_SECONDS = new Map([
  ["d", 86_400],
  ["h", 3_600],
  ["m", 60],
  ["s", 1],
  ["ms", 0.001],
]);

const DURATION = /^(?:\d+(?:\.\d+)?(?:ms|[dhms]))+$/;
const DURATION_PART = /(\d+(?:\.\d+)?)(ms|[dhms])/g;

/** A non-negative whole number within a sane bound, otherwise null. */
function toCount(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_COUNT
    ? value
    : null;
}

function headerCount(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value) ? toCount(Number(value)) : null;
}

/** Parses Groq's relative durations such as `2m59.56s`, `7.66s` or `1d2h` into seconds. */
export function parseGroqDuration(value: string | null): number | null {
  if (value === null || !DURATION.test(value)) return null;

  let milliseconds = 0;
  for (const [, amount, unit] of value.matchAll(DURATION_PART)) {
    const unitSeconds = UNIT_SECONDS.get(unit ?? "");
    if (unitSeconds === undefined) return null;
    milliseconds += Number(amount) * unitSeconds * 1000;
  }
  const seconds = Math.round(milliseconds) / 1000;
  return seconds <= MAX_DURATION_SECONDS ? seconds : null;
}

// Other fields of the body are not looked at, and a bad `usage` can never fail a command.
const usageBodySchema = v.object({
  usage: v.nullish(
    v.object({
      prompt_tokens: v.unknown(),
      completion_tokens: v.unknown(),
      total_tokens: v.unknown(),
    }),
  ),
});

export function parseUsage(body: unknown): AiAnswer["usage"] {
  const parsed = v.safeParse(usageBodySchema, body);
  if (!parsed.success || !parsed.output.usage) return null;

  const { prompt_tokens, completion_tokens, total_tokens } =
    parsed.output.usage;
  const usage = {
    prompt: toCount(prompt_tokens),
    completion: toCount(completion_tokens),
    total: toCount(total_tokens),
  };
  return Object.values(usage).some((figure) => figure !== null) ? usage : null;
}

function parseFigure(
  headers: Headers,
  kind: "requests" | "tokens",
  receivedAt: number,
): RateLimitFigure {
  const remaining = headerCount(headers.get(`x-ratelimit-remaining-${kind}`));
  const limit = headerCount(headers.get(`x-ratelimit-limit-${kind}`));
  const seconds = parseGroqDuration(headers.get(`x-ratelimit-reset-${kind}`));
  const resetsAt = seconds === null ? null : receivedAt + seconds * 1000;

  const contradictory =
    remaining !== null && limit !== null && remaining > limit;
  return contradictory
    ? { remaining: null, limit: null, resetsAt }
    : { remaining, limit, resetsAt };
}

export function parseLimits(
  headers: Headers,
  receivedAt: number,
): AiAnswer["limits"] {
  return {
    requests: parseFigure(headers, "requests", receivedAt),
    tokens: parseFigure(headers, "tokens", receivedAt),
  };
}

export function hasLimitFigure({ limits }: AiAnswer): boolean {
  return [limits.requests, limits.tokens].some((figure) =>
    Object.values(figure).some((part) => part !== null),
  );
}
