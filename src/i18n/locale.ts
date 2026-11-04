import type { Locale } from "./routing";

export const LOCALE_LABELS: Record<Locale, string> = { cs: "CZ", en: "EN" };

// Replaces the first path segment (the locale) and keeps the rest, including query and hash.
export function localizedPath(
  pathWithQueryAndHash: string,
  locale: Locale,
): string {
  return pathWithQueryAndHash.replace(/^\/[^/?#]*/, `/${locale}`);
}

// Same cookie next-intl uses, so "/" keeps redirecting by the last choice (session cookie).
export function localeCookie(locale: Locale): CookieInit {
  return { name: "NEXT_LOCALE", value: locale, path: "/", sameSite: "lax" };
}
