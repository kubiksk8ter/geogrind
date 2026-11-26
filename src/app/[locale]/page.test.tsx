import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "./page";

vi.mock("@/components/MapLoader", () => ({ MapLoader: () => null }));

describe("HomePage", () => {
  it("AC-6: renders exactly one level 1 heading reading GeoGrind", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "GeoGrind",
    );
  });
});
