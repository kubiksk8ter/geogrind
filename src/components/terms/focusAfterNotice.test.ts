import { afterEach, describe, expect, it } from "vitest";
import { focusTargetAfterNotice } from "./focusAfterNotice";

afterEach(() => {
  document.body.replaceChildren();
});

function root(html: string) {
  const element = document.createElement("section");
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

describe("focusTargetAfterNotice", () => {
  it("NFR-4: prefers the command input", () => {
    const section = root(
      '<div tabindex="0" id="map"></div><input type="text" id="command">',
    );

    expect(focusTargetAfterNotice(section)?.id).toBe("command");
  });

  it("NFR-4: falls back to the first control while the input is paused", () => {
    const section = root(
      '<div tabindex="-1"></div><button id="zoom">+</button><input type="text" disabled>',
    );

    expect(focusTargetAfterNotice(section)?.id).toBe("zoom");
  });

  it("returns null without a root or without any control", () => {
    expect(focusTargetAfterNotice(null)).toBeNull();
    expect(focusTargetAfterNotice(root("<p>text</p>"))).toBeNull();
  });
});
