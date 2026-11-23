import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { termsStore } from "@/test/termsStore";
import { TermsAcknowledgementProvider } from "./store/TermsAcknowledgementProvider";
import { TermsNotice } from "./TermsNotice";

beforeEach(() => {
  vi.stubGlobal("cookieStore", { set: () => Promise.resolve() });
  window.history.replaceState(null, "", "/en");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup() {
  const onOpenTerms = vi.fn();
  const target = document.createElement("button");
  document.body.append(target);
  render(
    <LocaleProvider initialLocale="en">
      <TermsAcknowledgementProvider store={termsStore()}>
        <TermsNotice
          onOpenTerms={onOpenTerms}
          focusTargetOnClose={() => target}
        />
      </TermsAcknowledgementProvider>
    </LocaleProvider>,
  );
  return { onOpenTerms, target };
}

describe("TermsNotice", () => {
  it("AC-5: the link asks for the Terms tab once the notice has closed, without returning focus", async () => {
    const { onOpenTerms, target } = setup();
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Terms and privacy" }),
    );

    await waitFor(() => expect(onOpenTerms).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(target);
  });

  it("NFR-4: “I understand” moves focus to the given target and does not open the terms", async () => {
    const { onOpenTerms, target } = setup();
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "I understand" }),
    );

    await waitFor(() => expect(document.activeElement).toBe(target));
    expect(onOpenTerms).not.toHaveBeenCalled();
  });
});
