"use client";

import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/i18n/LocaleProvider";
import {
  MAP_CONTROL_FOCUS_INSET_CLASS_NAME,
  TRANSITION_CLASS_NAME,
} from "../sharedConstants";
import type { PanelTabContentProps } from "../side-panel/panelTypes";
import { entryLabel } from "./entryLabel";
import { formatEntryTime } from "./formatEntryTime";
import { useHistoryStore } from "./HistoryStoreProvider";
import { useCurrentTime } from "./useCurrentTime";

export function HistoryTab({ showResult, onActivated }: PanelTabContentProps) {
  const t = useTranslations("panel.history");
  const { locale } = useLocaleSwitch();
  const entries = useHistoryStore((state) => state.entries);
  const commandInFlight = useHistoryStore((state) => state.commandInFlight);

  const now = useCurrentTime(entries.length);

  if (entries.length === 0) {
    return <p className="p-4 text-neutral-700">{t("empty")}</p>;
  }

  const disabled = showResult === null || commandInFlight;

  return (
    <ul aria-label={t("listLabel")} className="divide-y divide-neutral-300">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              showResult?.(entry.result);
              onActivated();
            }}
            className={`flex min-h-11 w-full cursor-pointer flex-col items-start gap-0.5 px-4 py-2 text-left transition-[background-color,box-shadow] duration-150 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-700 ${MAP_CONTROL_FOCUS_INSET_CLASS_NAME} ${TRANSITION_CLASS_NAME}`}
          >
            <span
              title={entry.text}
              className="max-w-full truncate text-neutral-900"
            >
              {entryLabel(entry.text)}
            </span>
            <time
              dateTime={new Date(entry.at).toISOString()}
              className="text-sm text-neutral-700"
            >
              {formatEntryTime(entry.at, now, locale)}
            </time>
          </button>
        </li>
      ))}
    </ul>
  );
}
