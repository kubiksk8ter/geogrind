"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";
import { APP_NAME, OPERATOR_CONTACT } from "@/config";
import type messages from "../../../messages/cs.json";
import {
  MAP_CONTROL_FOCUS_CLASS_NAME,
  TRANSITION_CLASS_NAME,
} from "../sharedConstants";
import { TERMS_VERSION } from "./termsConstants";

type SectionKey = keyof typeof messages.terms.document.sections;

const SERVER_ITEMS = [
  "ipAddress",
  "key",
  "records",
  "content",
  "host",
] as const;
const RECIPIENT_ITEMS = ["ai", "geocoder", "map", "tracking"] as const;

const AUTHORITY_URL = "https://www.uoou.cz";

const LIST_CLASS_NAME = "flex list-disc flex-col gap-2 pl-5";

/** Full terms of use and privacy notice; needs neither the map nor the network. */
export function TermsTab() {
  const t = useTranslations("terms.document");

  const sections: readonly { key: SectionKey; body: ReactNode }[] = [
    {
      key: "about",
      body: <p>{t("sections.about.text", { appName: APP_NAME })}</p>,
    },
    { key: "rules", body: <p>{t("sections.rules.text")}</p> },
    { key: "sensitiveData", body: <p>{t("sections.sensitiveData.text")}</p> },
    { key: "ai", body: <p>{t("sections.ai.text")}</p> },
    {
      key: "server",
      body: (
        <ul className={LIST_CLASS_NAME}>
          {SERVER_ITEMS.map((item) => (
            <li key={item}>{t(`sections.server.items.${item}`)}</li>
          ))}
        </ul>
      ),
    },
    {
      key: "recipients",
      body: (
        <ul className={LIST_CLASS_NAME}>
          {RECIPIENT_ITEMS.map((item) => (
            <li key={item}>{t(`sections.recipients.items.${item}`)}</li>
          ))}
        </ul>
      ),
    },
    { key: "browser", body: <p>{t("sections.browser.text")}</p> },
    {
      key: "rights",
      body: (
        // The e-mail address is one long word; it may break rather than overflow the panel.
        <p className="wrap-break-word">
          {t.rich("sections.rights.text", {
            contact: OPERATOR_CONTACT,
            authority: (chunks) => (
              <a
                href={AUTHORITY_URL}
                target="_blank"
                rel="noreferrer"
                className={`rounded-sm text-blue-800 underline underline-offset-2 transition-shadow duration-300 ${MAP_CONTROL_FOCUS_CLASS_NAME} ${TRANSITION_CLASS_NAME}`}
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      ),
    },
    { key: "changes", body: <p>{t("sections.changes.text")}</p> },
  ];

  return (
    <article className="flex flex-col gap-4 p-4 text-xs text-neutral-900">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="text-neutral-700">
          {t("version", { version: TERMS_VERSION })}
        </p>
      </header>
      {sections.map(({ key, body }, index) => (
        <TermsSection
          key={key}
          title={`${index + 1}. ${t(`sections.${key}.title`)}`}
        >
          {body}
        </TermsSection>
      ))}
    </article>
  );
}

function TermsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}
