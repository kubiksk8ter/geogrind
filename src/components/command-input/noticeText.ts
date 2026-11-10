import type { useTranslations } from "next-intl";
import type {
  CommandErrorCode,
  Locale,
} from "@/shared/command/commandContract";
import type { Notice } from "./notice";

type CommandTranslator = ReturnType<typeof useTranslations<"command">>;

const FAILURE_KEYS = {
  invalid_request: "invalidRequest",
  unsupported: "unsupported",
  not_found: "notFound",
  too_many_requests: "tooManyRequests",
  ai_resting: "aiResting",
  error: "error",
} as const satisfies Record<Exclude<CommandErrorCode, "wait">, string>;

// Only used when the server leaves out the wait time, which it never does.
const FALLBACK_RETRY_SECONDS = 60;

function formatTime(isoTimestamp: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}

/** The text of a notice in the current language; the notice itself holds only codes and numbers. */
export function noticeText(
  notice: Notice,
  t: CommandTranslator,
  locale: Locale,
): string {
  switch (notice.kind) {
    case "loading":
      return t("loading");
    case "pausedStart":
      return t("pausedStart", { seconds: notice.seconds });
    case "resumed":
      return t("resumed");
    case "failure":
      if (notice.code === "too_many_requests") {
        return t("tooManyRequests", {
          seconds: notice.retryAfterSeconds ?? FALLBACK_RETRY_SECONDS,
        });
      }
      if (notice.code === "ai_resting" && notice.resetAt) {
        return t("aiRestingUntil", {
          time: formatTime(notice.resetAt, locale),
        });
      }
      return t(FAILURE_KEYS[notice.code]);
  }
}
