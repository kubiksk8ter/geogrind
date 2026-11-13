"use client";

import { createMapEngine } from "@/map/maplibre-engine";
import { HistoryStoreProvider } from "../history/HistoryStoreProvider";
import { MapView } from "./MapView";

export default function MapRoot() {
  return (
    <HistoryStoreProvider>
      <MapView createEngine={createMapEngine} />
    </HistoryStoreProvider>
  );
}
