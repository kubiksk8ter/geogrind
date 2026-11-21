"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { APP_NAME } from "@/config";
import { LanguageSwitch } from "../language-switch/LanguageSwitch";
import {
  MAP_CONTROL_FOCUS_CLASS_NAME,
  TRANSITION_CLASS_NAME,
} from "../sharedConstants";
import { useTermsNotice } from "./store/TermsAcknowledgementProvider";

const POINTS = ["sensitiveData", "aiErrors", "ipAddress"] as const;

export interface TermsNoticeProps {
  /** Opens the side panel on the Terms tab; called once the notice has closed. */
  onOpenTerms(): void;
  /** The element to focus after "I understand" or Escape; null falls back to the default. */
  focusTargetOnClose(): HTMLElement | null;
}

/**
 * Start-up notice, shown until the current terms version is acknowledged. "I understand",
 * Escape and the link to the terms all acknowledge it; a click outside does not close it.
 */
export function TermsNotice({
  onOpenTerms,
  focusTargetOnClose,
}: TermsNoticeProps) {
  const t = useTranslations("terms.notice");
  const { noticeNeeded, acknowledge } = useTermsNotice();
  // The panel opens after the notice has gone, so that the two never fight over the focus.
  const openTermsAfterClose = useRef(false);

  return (
    <Dialog.Root
      open={noticeNeeded}
      onOpenChange={(open) => {
        if (!open) acknowledge();
      }}
      onOpenChangeComplete={(open) => {
        // Reset on opening, not on closing: finalFocus still needs it after the close completes.
        if (open) openTermsAfterClose.current = false;
        else if (openTermsAfterClose.current) onOpenTerms();
      }}
      disablePointerDismissal
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={`fixed inset-0 z-20 bg-neutral-950/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 ${TRANSITION_CLASS_NAME}`}
        />
        <Dialog.Popup
          finalFocus={() =>
            openTermsAfterClose.current ? false : focusTargetOnClose()
          }
          className={`fixed top-1/2 left-1/2 z-20 flex max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100dvw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-md bg-white text-neutral-900 shadow-xl ring-1 ring-neutral-500 transition-[opacity,scale] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 ${TRANSITION_CLASS_NAME}`}
        >
          <div className="flex items-start justify-between gap-3 p-5 pb-3">
            <Dialog.Title className="text-lg font-semibold">
              {t("title", { appName: APP_NAME })}
            </Dialog.Title>
            <LanguageSwitch orientation="horizontal" />
          </div>
          {/* Only this part scrolls when the text does not fit (large font, small screen). */}
          <div className="min-h-0 overflow-y-auto px-5 py-1">
            <Dialog.Description
              render={<ul />}
              className="flex list-disc flex-col gap-2 pl-5 text-sm"
            >
              {POINTS.map((point) => (
                <li key={point}>{t(`points.${point}`)}</li>
              ))}
            </Dialog.Description>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-5 pt-3">
            <button
              type="button"
              onClick={() => {
                openTermsAfterClose.current = true;
                acknowledge();
              }}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-sm text-left text-sm text-blue-800 underline underline-offset-2 transition-shadow duration-300 ${MAP_CONTROL_FOCUS_CLASS_NAME} ${TRANSITION_CLASS_NAME}`}
            >
              {t("openTerms")}
            </button>
            <Dialog.Close
              className={`min-h-11 cursor-pointer rounded-sm bg-neutral-900 px-5 text-sm font-semibold text-white transition-[background-color,box-shadow] duration-300 hover:bg-neutral-700 ${MAP_CONTROL_FOCUS_CLASS_NAME} ${TRANSITION_CLASS_NAME}`}
            >
              {t("confirm")}
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
