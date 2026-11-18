import type { Locale } from "@/i18n/routing";

export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Whole percent; the parts of a total are not corrected to add up to exactly 100 %. */
export function formatPercent(fraction: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(fraction);
}
