"use client";

import { createMapEngine } from "@/map/maplibre-engine";
import { MapView } from "./MapView";

export default function MapLibreMapView() {
  return <MapView createEngine={createMapEngine} />;
}
