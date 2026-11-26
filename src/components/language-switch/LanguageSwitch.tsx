"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/i18n/LocaleProvider";
import { LOCALE_LABELS } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import {
  MAP_CONTROL_CLASS_NAME,
  MAP_CONTROL_FOCUS_CLASS_NAME,
  TRANSITION_CLASS_NAME,
} from "../sharedConstants";

// Vertical: in the map's control stack, options as large as the zoom buttons (29 px).
// Horizontal: inside a dialog, same option size as in the map (29 px).
// Keep these complete literals for Tailwind.
const LAYOUT_CLASS_NAMES = {
  vertical: {
    group: "flex-col",
    option:
      "size-7.25 text-xs first-of-type:rounded-t-sm last-of-type:rounded-b-sm not-first-of-type:border-t",
  },
  horizontal: {
    group: "flex-row",
    option:
      "size-7.25 text-xs first-of-type:rounded-l-sm last-of-type:rounded-r-sm not-first-of-type:border-l",
  },
} as const;

export function LanguageSwitch({
  orientation = "vertical",
}: {
  orientation?: keyof typeof LAYOUT_CLASS_NAMES;
}) {
  const t = useTranslations("language");
  const { locale, setLocale } = useLocaleSwitch();
  const layout = LAYOUT_CLASS_NAMES[orientation];

  return (
    <RadioGroup
      aria-label={t("group")}
      value={locale}
      onValueChange={setLocale}
      className={`flex ${layout.group} bg-white ${MAP_CONTROL_CLASS_NAME}`}
    >
      {routing.locales.map((option) => (
        <Radio.Root
          key={option}
          value={option}
          aria-label={t(option)}
          className={`grid ${layout.option} cursor-pointer place-items-center font-semibold text-neutral-900 transition-[background-color,color,box-shadow] duration-300 data-checked:bg-neutral-900 data-checked:text-white not-first-of-type:border-neutral-300 ${MAP_CONTROL_FOCUS_CLASS_NAME} ${TRANSITION_CLASS_NAME}`}
        >
          {LOCALE_LABELS[option]}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
