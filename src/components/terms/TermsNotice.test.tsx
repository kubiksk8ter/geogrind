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

const SHARED_GLOW = "focus-visible:shadow-[0_0_2px_2px_#0096ff]";
const HOVER_GLOW = "not-disabled:hover:shadow-[0_0_2px_2px_#0096ff]";
const FORCED_COLOURS = "forced-colors:focus-visible:outline-2";
const REDUCED_MOTION = "motion-reduce:transition-none";

describe("TermsNotice", () => {
  it("AC-17: the link, the button and the language options use the shared focus and hover glow", async () => {
    setup();
    const dialog = await screen.findByRole("dialog");

    const controls = [
      within(dialog).getByRole("button", { name: "Terms and privacy" }),
      within(dialog).getByRole("button", { name: "I understand" }),
      ...within(dialog).getAllByRole("radio"),
    ];
    for (const control of controls) {
      expect(control.className).toContain(SHARED_GLOW);
      expect(control.className).toContain(HOVER_GLOW);
      expect(control.className).toContain(FORCED_COLOURS);
      expect(control.className).toMatch(
        /transition-\[[^\]]*box-shadow|transition-shadow/,
      );
      expect(control.className).toContain(REDUCED_MOTION);
    }
  });

  it("NFR-5: the buttons have touch targets of at least 44 px; the language switch matches the map", async () => {
    setup();
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByRole("button", { name: "I understand" }).className,
    ).toContain("min-h-11");
    expect(
      within(dialog).getByRole("button", { name: "Terms and privacy" })
        .className,
    ).toContain("min-h-11");
    for (const radio of within(dialog).getAllByRole("radio")) {
      expect(radio.className).toContain("size-7.25");
    }
  });

  it("AC-18: opening and closing are not animated with reduced motion", async () => {
    setup();
    const dialog = await screen.findByRole("dialog");

    const backdrop = document.querySelector("[role='presentation'][data-open]");
    expect(dialog.className).toContain(REDUCED_MOTION);
    expect(backdrop?.className).toContain(REDUCED_MOTION);
  });

  it("AC-19: the notice fits the screen and only its content scrolls", async () => {
    setup();
    const dialog = await screen.findByRole("dialog");

    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog.className).toContain("w-[min(28rem,calc(100dvw-2rem))]");
    expect(dialog.querySelector(".overflow-y-auto")).not.toBeNull();
  });

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
