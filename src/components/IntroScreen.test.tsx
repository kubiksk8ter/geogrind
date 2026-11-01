import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IntroScreen } from "./IntroScreen";

afterEach(cleanup);

describe("IntroScreen", () => {
  it("AC-2/AC-3: renders exactly one level 1 heading reading GeoGrind", () => {
    render(<IntroScreen />);

    const headings = screen.getAllByRole("heading");
    expect(headings).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "GeoGrind",
    );
  });

  it("AC-5: contains no interactive elements", () => {
    render(<IntroScreen />);

    for (const role of ["button", "link", "textbox", "combobox"]) {
      expect(screen.queryAllByRole(role)).toHaveLength(0);
    }
  });
});
