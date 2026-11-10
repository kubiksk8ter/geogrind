// Free-text search returns towns, landmarks and businesses side by side. Each result is sorted
// into a tier from the geocoder's own classification; no list of landmarks is maintained.
export interface Candidate {
  category: string;
  type?: string | undefined;
}

type Tier = "place" | "landmark" | "poi" | "ignored";

const PLACE_CATEGORIES = new Set([
  "boundary",
  "place",
  "natural",
  "waterway",
  "landuse",
  "highway",
]);
const LANDMARK_TOURISM_TYPES = new Set([
  "attraction",
  "museum",
  "viewpoint",
  "gallery",
  "zoo",
  "theme_park",
  "aquarium",
]);
const LANDMARK_MAN_MADE_TYPES = new Set([
  "tower",
  "lighthouse",
  "obelisk",
  "windmill",
]);
// Hotels, restaurants, shops, offices and the like; information boards are deliberately absent.
const POI_CATEGORIES = new Set([
  "tourism",
  "amenity",
  "shop",
  "office",
  "craft",
  "leisure",
  "healthcare",
]);
const NON_DESTINATION_TYPES = new Set(["information"]);

// Words that name a kind of POI, compared without diacritics and case.
const POI_KIND_WORDS = new Set([
  "hotel",
  "hotely",
  "hotelu",
  "hostel",
  "motel",
  "penzion",
  "pension",
  "ubytovani",
  "apartman",
  "apartmany",
  "apartment",
  "guesthouse",
  "inn",
  "restaurace",
  "restaurant",
  "hospoda",
  "pub",
  "bar",
  "cafe",
  "kavarna",
  "bistro",
  "pizzeria",
  "obchod",
  "shop",
  "store",
  "supermarket",
  "kancelar",
  "office",
]);

function tierOf({ category, type }: Candidate): Tier {
  if (PLACE_CATEGORIES.has(category)) return "place";
  if (type !== undefined && NON_DESTINATION_TYPES.has(type)) return "ignored";
  if (category === "information") return "ignored";
  if (category === "historic") return "landmark";
  if (
    type !== undefined &&
    ((category === "tourism" && LANDMARK_TOURISM_TYPES.has(type)) ||
      (category === "man_made" && LANDMARK_MAN_MADE_TYPES.has(type)))
  ) {
    return "landmark";
  }
  return POI_CATEGORIES.has(category) ? "poi" : "ignored";
}

export function isLandmark(candidate: Candidate): boolean {
  return tierOf(candidate) === "landmark";
}

function wordsOf(query: string): string[] {
  return query
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u);
}

export function namesPoiKind(query: string): boolean {
  return wordsOf(query).some((word) => POI_KIND_WORDS.has(word));
}

/**
 * Picks the result to show, keeping the geocoder's order within a tier:
 * - a query naming a kind of POI ("hotel Eiffel") gets the first POI, if there is one;
 * - otherwise a place or landmark wins over any POI;
 * - a POI is the last resort when nothing better matched.
 */
export function pickBest<T extends Candidate>(
  query: string,
  results: readonly T[],
): T | undefined {
  const tiered = results.map((result) => ({ result, tier: tierOf(result) }));
  const firstOf = (accepts: (tier: Tier) => boolean) =>
    tiered.find(({ tier }) => accepts(tier))?.result;
  const poi = firstOf((tier) => tier === "poi");

  if (namesPoiKind(query) && poi) return poi;
  return firstOf((tier) => tier === "place" || tier === "landmark") ?? poi;
}
