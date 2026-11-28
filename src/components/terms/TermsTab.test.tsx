import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_CONTACT } from "@/config";
import { LocaleProvider, useLocaleSwitch } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/routing";
import { TermsTab } from "./TermsTab";
import { TERMS_VERSION } from "./termsConstants";

beforeEach(() => {
  vi.stubGlobal("cookieStore", { set: () => Promise.resolve() });
  window.history.replaceState(null, "", "/cs");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let switchLocale: (next: Locale) => void = () => {};
function CaptureSwitch({ children }: { children: ReactNode }) {
  switchLocale = useLocaleSwitch().setLocale;
  return children;
}

function renderTab(locale: Locale) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <CaptureSwitch>
        <TermsTab />
      </CaptureSwitch>
    </LocaleProvider>,
  );
}

const SECTION_TITLES = {
  cs: [
    "1. O službě",
    "2. Pravidla používání",
    "3. Nezadávejte citlivé údaje",
    "4. Umělá inteligence není spolehlivá",
    "5. Jaké údaje zpracováváme na serveru",
    "6. Kam se údaje odesílají",
    "7. Údaje ve vašem prohlížeči",
    "8. Vaše práva",
    "9. Změny",
  ],
  en: [
    "1. About the service",
    "2. Rules of use",
    "3. Do not enter sensitive data",
    "4. AI is not reliable",
    "5. What we process on the server",
    "6. Where data is sent",
    "7. Data in your browser",
    "8. Your rights",
    "9. Changes",
  ],
} as const;

describe("TermsTab", () => {
  it.each([
    [
      "cs",
      "Podmínky užívání a zásady ochrany osobních údajů",
      "(verze 2026-11-28)",
    ],
    ["en", "Terms of use and privacy notice", "(version 2026-11-28)"],
  ] as const)(
    "AC-11, NFR-5: in %s the text is a headed document with nine numbered sections",
    (locale, title, version) => {
      renderTab(locale);

      expect(
        screen.getByRole("heading", { level: 2, name: title }),
      ).toBeDefined();
      expect(screen.getByText(version)).toBeDefined();
      expect(
        screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
      ).toEqual(SECTION_TITLES[locale]);
    },
  );

  it("AC-12: the server and the recipient sections are lists of all their items", () => {
    renderTab("en");

    const list = (section: string) =>
      within(screen.getByRole("region", { name: section })).getAllByRole(
        "listitem",
      );
    expect(list("5. What we process on the server")).toHaveLength(5);
    expect(
      list("6. Where data is sent").map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("Groq (USA)"),
      expect.stringContaining("Nominatim"),
      expect.stringContaining("OpenFreeMap"),
      expect.stringContaining("no analytics"),
    ]);
  });

  it.each(["en", "cs"] as const)(
    "AC-12: the %s text names every required item and shows no draft remark",
    (locale) => {
      const { container } = renderTab(locale);
      const text = container.textContent ?? "";

      for (const fact of [
        "GeoGrind",
        "UTC",
        "60",
        "Groq",
        "Nominatim",
        "OpenFreeMap",
        "sessionStorage",
        "localStorage",
        "www.uoou.cz",
        TERMS_VERSION,
      ]) {
        expect(text).toContain(fact);
      }
      expect(text).not.toMatch(/draft|legal advice|koncept|právní rad/i);
    },
  );

  it.each([
    [
      "en",
      "Operator: the author of the project. You can contact the operator by e-mail using the envelope icon link at the bottom of this panel.",
      "To exercise your rights, send an e-mail to jakub.holecek31@gmail.com or use the envelope icon link at the bottom of this panel.",
    ],
    [
      "cs",
      "Provozovatel: autor projektu. Kontaktovat ho můžete e-mailem přes odkaz s ikonou obálky v dolní části tohoto panelu.",
      "Svá práva můžete uplatnit e-mailem na adrese jakub.holecek31@gmail.com nebo přes odkaz s ikonou obálky v dolní části tohoto panelu.",
    ],
  ] as const)(
    "spec 014 AC-21, AC-24: the %s operator contact is in 'Your rights' only, as plain text",
    (locale, aboutSentence, rightsSentence) => {
      const { container } = renderTab(locale);
      const text = container.textContent ?? "";
      const about = screen.getByRole("region", {
        name: SECTION_TITLES[locale][0],
      });
      const rights = screen.getByRole("region", {
        name: SECTION_TITLES[locale][7],
      });

      expect(OPERATOR_CONTACT).toBe("jakub.holecek31@gmail.com");
      expect(about.textContent).toContain(aboutSentence);
      expect(about.textContent).not.toContain(OPERATOR_CONTACT);
      expect(rights.textContent?.endsWith(rightsSentence)).toBe(true);
      // The address appears once in the whole text, and as plain text, not as a further link.
      expect(text.split(OPERATOR_CONTACT)).toHaveLength(2);
      expect(
        within(rights)
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual(["www.uoou.cz"]);
      expect(text).not.toContain("[TODO]");
      expect(text).not.toMatch(/duckdns/i);
    },
  );

  it("spec 014 FR-16: the terms version is the date of the contact change", () => {
    expect(TERMS_VERSION).toBe("2026-11-28");
  });

  it.each([
    ["en", "5. What we process on the server", "Hluboká nad Vltavou"],
    ["cs", "5. Jaké údaje zpracováváme na serveru", "Hluboké nad Vltavou"],
  ] as const)(
    "AC-20 (spec 013): the %s host note names the host, its data centre and the log periods",
    (locale, section, dataCentre) => {
      renderTab(locale);

      const host = within(screen.getByRole("region", { name: section }))
        .getAllByRole("listitem")
        .at(-1)?.textContent;

      expect(host).toContain("WEDOS");
      expect(host).toContain(dataCentre);
      expect(host).toMatch(/14 (days|dní)/);
      expect(host).toMatch(/6 (months|měsíců)/);
    },
  );

  it("AC-11: switching the language changes the whole text at once", () => {
    const { container } = renderTab("cs");

    act(() => switchLocale("en"));

    expect(
      screen.getByRole("heading", { name: "Terms of use and privacy notice" }),
    ).toBeDefined();
    // The data-centre town is a proper name and keeps its spelling in English.
    const text = container.textContent?.replace("Hluboká nad Vltavou", "");
    expect(text).not.toMatch(/[ěščřžýáíéůú]/);
  });

  it("AC-17: the authority link points to the Czech data protection authority", () => {
    renderTab("en");

    const link = screen.getByRole("link", { name: "www.uoou.cz" });

    expect(link.getAttribute("href")).toBe("https://www.uoou.cz");
  });
});
