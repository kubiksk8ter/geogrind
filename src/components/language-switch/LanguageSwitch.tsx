"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/i18n/LocaleProvider";
import { LOCALE_LABELS } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import {
  FOCUS_RING_CLASS_NAME,
  TRANSITION_CLASS_NAME,
} from "../sharedConstants";

export function LanguageSwitch() {
  const t = useTranslations("language");
  const { locale, setLocale } = useLocaleSwitch();

  return (
    <RadioGroup
      aria-label={t("group")}
      value={locale}
      onValueChange={setLocale}
      className="flex flex-col overflow-hidden rounded-md bg-white shadow-md ring-1 ring-neutral-500"
    >
      {routing.locales.map((option) => (
        <Radio.Root
          key={option}
          value={option}
          aria-label={t(option)}
          className={`grid size-7.25 cursor-pointer place-items-center text-xs font-semibold text-neutral-900 transition-[background-color,color] duration-300 data-checked:bg-neutral-900 data-checked:text-white ${FOCUS_RING_CLASS_NAME} -outline-offset-3 ${TRANSITION_CLASS_NAME}`}
        >
          {LOCALE_LABELS[option]}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
