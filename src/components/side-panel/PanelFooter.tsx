"use client";

import { useTranslations } from "next-intl";
import { OPERATOR_CONTACT } from "@/config";
import {
  MAP_CONTROL_FOCUS_INSET_CLASS_NAME,
  TRANSITION_CLASS_NAME,
} from "../sharedConstants";
import { PANEL_LINKS } from "./panelLinks";

/**
 * Bottom edge of the panel, visible on every tab: icon links to the source code, the author and
 * the operator's e-mail.
 */
export function PanelFooter() {
  const t = useTranslations("panel.links");

  return (
    <footer className="flex shrink-0 justify-end border-t border-neutral-300 pb-[env(safe-area-inset-bottom)]">
      {PANEL_LINKS.map(({ id, href, Mark, markClassName }) => {
        const label = t(id, { address: OPERATOR_CONTACT });
        return (
          <a
            key={id}
            href={href}
            // A new tab keeps the app as it is (also with a webmail handling mailto); noopener and
            // noreferrer give the opened page neither access to this one nor its address.
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            // The link is 36 px to keep the footer compact; the pseudo-element extends its touch
            // target upwards to 44 px. The links sit next to each other, so it stays 36 px wide.
            className={`relative grid size-9 place-items-center text-black transition-shadow duration-300 ${MAP_CONTROL_FOCUS_INSET_CLASS_NAME} ${TRANSITION_CLASS_NAME} after:absolute after:inset-x-0 after:-top-2 after:bottom-0 after:content-['']`}
          >
            <Mark className={markClassName} />
          </a>
        );
      })}
    </footer>
  );
}
