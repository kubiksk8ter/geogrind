import { describe, expect, it, vi } from "vitest";
import { createTileAvailability } from "./tileAvailability";

function setup(failureThreshold = 3) {
  const onChange = vi.fn();
  const availability = createTileAvailability({ failureThreshold, onChange });
  return { availability, onChange };
}

describe("tile availability", () => {
  it("is unknown until the first tile and then available", () => {
    const { availability, onChange } = setup();
    expect(onChange).not.toHaveBeenCalled();

    availability.tileLoaded();
    availability.tileLoaded();

    expect(onChange).toHaveBeenCalledExactlyOnceWith("available");
  });

  it("AC-9: a single transient error does not make it unavailable", () => {
    const { availability, onChange } = setup();
    availability.tileLoaded();

    availability.tileFailed();
    availability.tileLoaded();
    availability.tileFailed();
    availability.tileFailed();

    expect(onChange.mock.calls).toEqual([["available"]]);
  });

  it("AC-9: consecutive errors up to the threshold make it unavailable", () => {
    const { availability, onChange } = setup(3);
    availability.tileLoaded();

    availability.tileFailed();
    availability.tileFailed();
    availability.tileFailed();
    availability.tileFailed();

    expect(onChange.mock.calls).toEqual([["available"], ["unavailable"]]);
  });

  it("AC-9: errors before any tile loaded also make it unavailable", () => {
    const { availability, onChange } = setup(3);

    for (let i = 0; i < 3; i++) availability.tileFailed();

    expect(onChange).toHaveBeenCalledExactlyOnceWith("unavailable");
  });

  it("AC-9: one loaded tile makes it available again at once", () => {
    const { availability, onChange } = setup(3);
    for (let i = 0; i < 3; i++) availability.tileFailed();

    availability.tileLoaded();

    expect(onChange.mock.calls).toEqual([["unavailable"], ["available"]]);
  });
});
