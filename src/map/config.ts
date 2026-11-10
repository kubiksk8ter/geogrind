type LngLat = [longitude: number, latitude: number];

export const MAP_CONFIG: {
  styleUrl: string;
  /** [[west, south], [east, north]] */
  /** The view the map opens with; commands may move it anywhere in the world. */
  czechBounds: [LngLat, LngLat];
  loadTimeoutMs: number;
  /** Highest zoom when moving to a target, so a village or a street is not zoomed to the rooftops. */
  targetMaxZoom: number;
} = {
  styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  czechBounds: [
    [12.09, 48.55],
    [18.87, 51.06],
  ],
  loadTimeoutMs: 20_000,
  targetMaxZoom: 15,
};
