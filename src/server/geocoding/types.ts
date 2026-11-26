import type { Bounds } from "@/shared/actions";
import type { Highlight } from "@/shared/highlightSchema";

export interface Geocoder {
  /**
   * The place's bounding box and, for landmarks and other small objects, the geometry to draw;
   * null when nothing was found. Other failures throw.
   */
  find(
    place: string,
    signal: AbortSignal,
  ): Promise<{ bounds: Bounds; highlight?: Highlight } | null>;
}

/** The geocoder failed; the message never contains the provider's response. */
export class GeocoderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GeocoderError";
  }
}
