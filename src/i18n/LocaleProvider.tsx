"use client";

import { NextIntlClientProvider } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import cs from "../../messages/cs.json";
import en from "../../messages/en.json";
import { localeCookie, localizedPath } from "./locale";
import type { Locale } from "./routing";

export interface LocaleSwitch {
  locale: Locale;
  setLocale(next: Locale): void;
}

const MESSAGES = { cs, en } satisfies Record<Locale, typeof cs>;

const LocaleSwitchContext = createContext<LocaleSwitch | null>(null);

// The locale is client state: a router navigation between /cs and /en would reload the page
// (the locale is a root layout param) and recreate the map.
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      setLocaleState(next);
      const { pathname, search, hash } = window.location;
      window.history.replaceState(
        null,
        "",
        localizedPath(`${pathname}${search}${hash}`, next),
      );
      document.documentElement.lang = next;
      // A blocked cookie only means the next visit falls back to URL / Accept-Language.
      cookieStore.set(localeCookie(next)).catch(() => {});
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleSwitchContext value={value}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    </LocaleSwitchContext>
  );
}

export function useLocaleSwitch(): LocaleSwitch {
  const value = useContext(LocaleSwitchContext);
  if (!value) throw new Error("useLocaleSwitch needs a LocaleProvider");
  return value;
}
