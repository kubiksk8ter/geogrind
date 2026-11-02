type LngLat = [longitude: number, latitude: number];

export const MAP_CONFIG: {
  styleUrl: string;
  /** [[west, south], [east, north]] */
  czechBounds: [LngLat, LngLat];
  loadTimeoutMs: number;
} = {
  styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  czechBounds: [
    [12.09, 48.55],
    [18.87, 51.06],
  ],
  loadTimeoutMs: 20_000,
};
