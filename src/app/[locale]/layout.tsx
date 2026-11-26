import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html lang={locale} className="overflow-hidden">
      <body className="overflow-hidden bg-neutral-200 font-sans text-neutral-900">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
