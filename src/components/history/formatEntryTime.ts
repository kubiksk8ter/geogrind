import type { Locale } from "@/i18n/routing";

const TIME_ONLY: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};
const DATE_AND_TIME: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const isSameLocalDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

/** Time only for today, date and time for earlier days, in the language of the page. */
export function formatEntryTime(at: number, now: number, locale: Locale) {
  const entryDate = new Date(at);
  const options = isSameLocalDay(entryDate, new Date(now))
    ? TIME_ONLY
    : DATE_AND_TIME;
  return new Intl.DateTimeFormat(locale, options).format(entryDate);
}
