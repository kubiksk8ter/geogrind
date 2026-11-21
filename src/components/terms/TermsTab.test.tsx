import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocaleSwitch } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/routing";
import { TermsTab } from "./TermsTab";
import { OPERATOR_CONTACT, TERMS_VERSION } from "./termsConstants";

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
      "(verze 2026-11-19)",
    ],
    ["en", "Terms of use and privacy notice", "(version 2026-11-19)"],
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

  it("the operator contact comes from one constant and the open placeholders stay visible", () => {
    const { container } = renderTab("en");

    expect(
      screen.getByText(/Operator: the author of the project/).textContent,
    ).toContain(`contact ${OPERATOR_CONTACT}.`);
    expect(container.textContent?.match(/\[TODO\]/g)).toHaveLength(2);
  });

  it("AC-11: switching the language changes the whole text at once", () => {
    const { container } = renderTab("cs");

    act(() => switchLocale("en"));

    expect(
      screen.getByRole("heading", { name: "Terms of use and privacy notice" }),
    ).toBeDefined();
    expect(container.textContent).not.toMatch(/[ěščřžýáíéůú]/);
  });

  it("AC-17: the authority link uses the shared focus style with the fading transition", () => {
    renderTab("en");

    const link = screen.getByRole("link", { name: "www.uoou.cz" });

    expect(link.getAttribute("href")).toBe("https://www.uoou.cz");
    expect(link.className).toContain(
      "focus-visible:shadow-[0_0_2px_2px_#0096ff]",
    );
    expect(link.className).toContain("forced-colors:focus-visible:outline-2");
    expect(link.className).toContain("transition-shadow");
    expect(link.className).toContain("motion-reduce:transition-none");
  });
});
