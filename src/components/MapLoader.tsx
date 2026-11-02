"use client";

import dynamic from "next/dynamic";
import { FULL_SCREEN } from "./styles";

// MapLibre needs window and WebGL, so it is loaded in the browser only.
export const MapLoader = dynamic(() => import("./MapLibreMapView"), {
  ssr: false,
  loading: () => <div className={FULL_SCREEN} />,
});
