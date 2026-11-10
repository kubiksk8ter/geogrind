import type { Bounds } from "@/shared/command/actions";

export interface Geocoder {
  /** The place's bounding box, or null when nothing was found. Other failures throw. */
  find(place: string, signal: AbortSignal): Promise<{ bounds: Bounds } | null>;
}

/** The geocoder failed; the message never contains the provider's response. */
export class GeocoderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GeocoderError";
  }
}
