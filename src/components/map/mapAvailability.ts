import { createContext, useContext } from "react";
import type { MapAvailability } from "@/map";

/** The map state of this browser only; it is never sent to the server. */
export const MapAvailabilityContext = createContext<MapAvailability>("unknown");

export function useMapAvailability(): MapAvailability {
  return useContext(MapAvailabilityContext);
}
