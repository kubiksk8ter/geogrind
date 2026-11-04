"use client";

import { Input } from "@base-ui/react/input";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FOCUS_RING_CLASS_NAME } from "../sharedConstants";
import { PLACEHOLDER_KEYS } from "./placeholderConstants";
import { usePlaceholderRotation } from "./usePlaceholderRotation";

// UI only: the typed text is not processed yet, so Enter intentionally does nothing.
export function CommandInput() {
  const t = useTranslations("input");
  const [value, setValue] = useState("");
  const hintIndex = usePlaceholderRotation({
    count: PLACEHOLDER_KEYS.length,
    paused: value !== "",
  });
  const hintKey = PLACEHOLDER_KEYS[hintIndex] ?? PLACEHOLDER_KEYS[0];

  return (
    <div className="absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2">
      <Input
        type="text"
        aria-label={t("label")}
        placeholder={t(`placeholders.${hintKey}`)}
        value={value}
        onValueChange={setValue}
        autoComplete="off"
        className={`h-11 w-full rounded-md border border-neutral-500 bg-white px-4 text-base text-neutral-900 shadow-md placeholder:text-neutral-600 ${FOCUS_RING_CLASS_NAME}`}
      />
    </div>
  );
}
