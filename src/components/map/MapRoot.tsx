"use client";

import { createMapEngine } from "@/map/maplibre-engine";
import { HistoryStoreProvider } from "../history/store/HistoryStoreProvider";
import { TermsAcknowledgementProvider } from "../terms/store/TermsAcknowledgementProvider";
import { MapView } from "./MapView";

export default function MapRoot() {
  return (
    <TermsAcknowledgementProvider>
      <HistoryStoreProvider>
        <MapView createEngine={createMapEngine} />
      </HistoryStoreProvider>
    </TermsAcknowledgementProvider>
  );
}
