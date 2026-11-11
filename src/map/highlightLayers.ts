import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type { Highlight } from "@/shared/command/highlightSchema";

export const HIGHLIGHT_SOURCE_ID = "highlight";

// Magenta stands out from the pale land, green and blue of the Liberty style; the white casing
// keeps lines and points readable over roads, water and dark areas.
const COLOR = "#d6007a";
const CASING_COLOR = "#ffffff";

export function highlightData(
  highlight: Highlight | undefined,
): GeoJSONSourceSpecification["data"] {
  return {
    type: "FeatureCollection",
    features: highlight
      ? [{ type: "Feature", properties: {}, geometry: highlight }]
      : [],
  };
}

// Every paint property that controls how opaque the highlight is, for fading it out.
export const HIGHLIGHT_OPACITY_PROPERTIES = [
  ["highlight-casing", "line-opacity"],
  ["highlight-line", "line-opacity"],
  ["highlight-point", "circle-opacity"],
  ["highlight-point", "circle-stroke-opacity"],
] as const;

// Bottom to top. Areas are outlined only, with no fill: touching or nested shapes (river
// branches, riverbanks) would otherwise merge into one coloured mass. The line layers draw the
// outlines of polygons and lines; a circle layer would also draw every vertex of a line or
// area, hence its filter.
export const HIGHLIGHT_LAYERS: [
  LineLayerSpecification,
  LineLayerSpecification,
  CircleLayerSpecification,
] = [
  {
    id: "highlight-casing",
    type: "line",
    source: HIGHLIGHT_SOURCE_ID,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": CASING_COLOR, "line-width": 1 },
  },
  {
    id: "highlight-line",
    type: "line",
    source: HIGHLIGHT_SOURCE_ID,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": COLOR, "line-width": 2 },
  },
  {
    id: "highlight-point",
    type: "circle",
    source: HIGHLIGHT_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-color": COLOR,
      "circle-radius": 4,
      "circle-stroke-color": CASING_COLOR,
      "circle-stroke-width": 1,
    },
  },
];
