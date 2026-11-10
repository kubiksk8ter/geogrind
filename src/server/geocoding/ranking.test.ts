import { describe, expect, it } from "vitest";
import { namesPoiKind, pickBest } from "./ranking";

const hotel = { name: "hotel", category: "tourism", type: "hotel" };
const shop = { name: "shop", category: "shop", type: "gift" };
const board = { name: "board", category: "tourism", type: "information" };
const tower = { name: "tower", category: "tourism", type: "attraction" };
const castle = { name: "castle", category: "historic", type: "castle" };
const town = { name: "town", category: "boundary", type: "administrative" };

describe("namesPoiKind", () => {
  it.each([
    "Hotel Eiffel Paris",
    "Přibliž na hotel Eiffel",
    "restaurace U Fleků",
    "Restaurant Eiffel",
    "penzion Slunce",
    "Kavárna Slavia",
    "OFFICE Praha",
  ])("recognises a POI kind in %s", (query) => {
    expect(namesPoiKind(query)).toBe(true);
  });

  it.each(["Eiffel", "Eiffelova věž", "Koloseum", "Vienna", "Barcelona"])(
    "does not see a POI kind in %s",
    (query) => {
      expect(namesPoiKind(query)).toBe(false);
    },
  );
});

describe("pickBest", () => {
  it("returns nothing for no answers", () => {
    expect(pickBest("Eiffel", [])).toBeUndefined();
  });

  it("returns nothing when only boards match", () => {
    expect(pickBest("Eiffel", [board, board])).toBeUndefined();
  });

  it("ignores unknown kinds of objects", () => {
    const railway = { category: "railway", type: "station" };
    expect(pickBest("Eiffel", [railway])).toBeUndefined();
  });

  it("prefers a landmark to a hotel listed first", () => {
    expect(pickBest("Eiffel", [hotel, shop, tower])).toBe(tower);
  });

  it("prefers a hotel for a query naming a hotel", () => {
    expect(pickBest("hotel Eiffel", [tower, hotel])).toBe(hotel);
  });

  it("falls back to the landmark when a hotel query finds no hotel", () => {
    expect(pickBest("hotel Eiffel", [board, tower])).toBe(tower);
  });

  it("returns the only POI for any query", () => {
    expect(pickBest("Eiffel", [board, shop])).toBe(shop);
  });

  it("prefers a place to a hotel", () => {
    expect(pickBest("Vienna", [hotel, town])).toBe(town);
  });

  it("keeps the geocoder order between a place and a landmark", () => {
    expect(pickBest("Karlštejn", [castle, town])).toBe(castle);
    expect(pickBest("Karlštejn", [town, castle])).toBe(town);
  });
});
