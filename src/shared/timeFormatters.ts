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

/**
 * Time left as a short localised text such as "2 min 59 s". Seconds are rounded up and carried
 * into the larger units, so "60 s" never appears; zero and negative values read "0 s".
 */
export function formatCountdown(milliseconds: number, locale: Locale): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const duration = {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
  // An all-zero duration would otherwise format as an empty text.
  const secondsDisplay = totalSeconds === 0 ? "always" : "auto";
  return new Intl.DurationFormat(locale, {
    style: "short",
    secondsDisplay,
  }).format(duration);
}

/**
 * Time left as a fixed "HHh MMm SSs" clock, the same in every language. Seconds are rounded up and
 * carried into the larger units; hours are not capped, so a longer time never wraps around.
 */
export function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const part = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  return `${part(hours)}h ${part(minutes)}m ${part(totalSeconds % 60)}s`;
}
