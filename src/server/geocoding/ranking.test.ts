import { describe, expect, it } from "vitest";
import { isHighlighted, namesPoiKind, pickBest } from "./ranking";

const hotel = { name: "hotel", category: "tourism", type: "hotel" };
const shop = { name: "shop", category: "shop", type: "gift" };
const board = { name: "board", category: "tourism", type: "information" };
const tower = { name: "tower", category: "tourism", type: "attraction" };
const castle = { name: "castle", category: "historic", type: "castle" };
const town = { name: "town", category: "boundary", type: "administrative" };

describe("isHighlighted", () => {
  it.each([
    ["AC-1: a landmark", castle],
    ["AC-6: a hotel", hotel],
    ["AC-6: a shop", shop],
    ["AC-3: a river", { category: "waterway", type: "river" }],
    ["AC-3: a street", { category: "highway", type: "residential" }],
    ["AC-1: a peak", { category: "natural", type: "peak" }],
  ])("%s is highlighted", (_name, candidate) => {
    expect(isHighlighted(candidate)).toBe(true);
  });

  it.each([
    ["a country, state or district", town],
    ["a town or village", { category: "place", type: "town" }],
    ["a national park", { category: "boundary", type: "national_park" }],
    ["a land-use area", { category: "landuse", type: "forest" }],
    ["an information board", board],
  ])("AC-5: %s is not highlighted", (_name, candidate) => {
    expect(isHighlighted(candidate)).toBe(false);
  });
});

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
