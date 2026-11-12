"use client";

import { Input } from "@base-ui/react/input";
import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/i18n/LocaleProvider";
import type { MapTarget } from "@/map";
import { MAX_COMMAND_LENGTH } from "@/shared/text";
import {
  FOCUS_RING_CLASS_NAME,
  TRANSITION_CLASS_NAME,
} from "../sharedConstants";
import { sendCommand } from "./commandClient";
import { noticeSeverity } from "./notice";
import { noticeText } from "./noticeText";
import { PLACEHOLDER_KEYS } from "./placeholderConstants";
import { useCommandInputController } from "./useCommandInputController";
import { usePlaceholderRotation } from "./usePlaceholderRotation";

const MESSAGE_BASE_CLASS_NAME = "rounded-md border px-3 py-2 text-sm shadow-md";
// Keep these complete literals for Tailwind.
const MESSAGE_CLASS_NAMES = {
  info: `${MESSAGE_BASE_CLASS_NAME} border-neutral-500 bg-white text-neutral-900`,
  warning: `${MESSAGE_BASE_CLASS_NAME} border-amber-600 bg-amber-100 text-amber-950`,
  error: `${MESSAGE_BASE_CLASS_NAME} border-red-700 bg-red-100 text-red-950`,
} as const;

export function CommandInput({
  onMoveAction,
  onSendAction,
}: {
  /** Moves the map; null while the map is not ready. */
  onMoveAction: ((target: MapTarget) => void) | null;
  /** Called when a command is sent, before the answer arrives. */
  onSendAction: () => void;
}) {
  const t = useTranslations("input");
  const tCommand = useTranslations("command");
  const { locale } = useLocaleSwitch();
  const { value, setValue, submit, notice, pausedSeconds, inputRef } =
    useCommandInputController({
      client: sendCommand,
      onMove: onMoveAction,
      onSend: onSendAction,
      locale,
    });
  const hintIndex = usePlaceholderRotation({
    count: PLACEHOLDER_KEYS.length,
    paused: value !== "",
  });
  const hintKey = PLACEHOLDER_KEYS[hintIndex] ?? PLACEHOLDER_KEYS[0];
  const loading = notice?.kind === "loading";
  const text = notice && noticeText(notice, tCommand, locale);
  // Pause announcements are spoken only; the visible countdown below is not a live region.
  const spokenOnly =
    notice?.kind === "pausedStart" || notice?.kind === "resumed";

  return (
    <form
      className="absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="absolute bottom-full mb-2 w-full">
        <div role="status">
          {text &&
            (spokenOnly ? (
              <p className="sr-only">{text}</p>
            ) : (
              <p className={MESSAGE_CLASS_NAMES[noticeSeverity(notice)]}>
                {text}
              </p>
            ))}
        </div>
      </div>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          enterKeyHint="send"
          aria-label={t("label")}
          aria-busy={loading}
          placeholder={t(`placeholders.${hintKey}`)}
          value={value}
          onValueChange={setValue}
          disabled={pausedSeconds !== null}
          maxLength={MAX_COMMAND_LENGTH}
          autoComplete="off"
          className={`h-11 w-full rounded-md border border-neutral-500 bg-white px-4 text-base text-neutral-900 shadow-md outline-3 outline-solid outline-transparent forced-colors:not-focus-visible:outline-0 transition-[border-color,outline-color] duration-300 focus-visible:duration-700 placeholder:text-neutral-600 focus-visible:border-blue-600 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-700 ${pausedSeconds !== null ? "pr-20" : ""} ${FOCUS_RING_CLASS_NAME} ${TRANSITION_CLASS_NAME}`}
        />
        {pausedSeconds !== null && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2 text-sm text-neutral-700 tabular-nums"
          >
            <svg
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="3"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            {tCommand("countdown", { seconds: pausedSeconds })}
          </span>
        )}
      </div>
    </form>
  );
}
