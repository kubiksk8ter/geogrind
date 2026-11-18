export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

export interface PieSlice<K extends string> {
  key: K;
  /** Share of the total, 0 to 1. */
  fraction: number;
  /** SVG path data of the slice. */
  d: string;
}

export interface Point {
  x: number;
  y: number;
}

// Three decimals keep the paths short and stable without a visible difference.
const round = (value: number) => Math.round(value * 1000) / 1000;

/** The point on the circle at `turn` (0 to 1) clockwise from the top. */
function pointAt({ cx, cy, r }: Circle, turn: number): Point {
  const angle = turn * 2 * Math.PI - Math.PI / 2;
  return {
    x: round(cx + r * Math.cos(angle)),
    y: round(cy + r * Math.sin(angle)),
  };
}

/** An arc to its own start draws nothing, so a whole circle is two half arcs. */
function fullCircle({ cx, cy, r }: Circle): string {
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
}

/**
 * Slices clockwise from the top, in the given order. Entries with 0 are left out (the legend
 * keeps them); a total of 0 gives no slices, so no stand-in circle is ever drawn.
 */
export function pieSlices<K extends string>(
  entries: readonly { key: K; count: number }[],
  circle: Circle,
): PieSlice<K>[] {
  const total = entries.reduce((sum, { count }) => sum + count, 0);
  if (total <= 0) return [];

  const slices: PieSlice<K>[] = [];
  let start = 0;
  for (const { key, count } of entries) {
    if (count <= 0) continue;
    const fraction = count / total;
    const end = start + fraction;
    slices.push({ key, fraction, d: slicePath(circle, start, end) });
    start = end;
  }
  return slices;
}

function slicePath(circle: Circle, start: number, end: number): string {
  if (end - start >= 1) return fullCircle(circle);
  const { cx, cy, r } = circle;
  const from = pointAt(circle, start);
  const to = pointAt(circle, end);
  const largeArc = end - start > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
}

export interface SparklineBox {
  width: number;
  height: number;
  /** Space kept free at every edge, so the stroke and the dots are not cut off. */
  inset: number;
}

export interface Sparkline {
  /** Path data of the stretches between two real values; empty when there is none. */
  d: string;
  /** Path data of the stretches that touch an empty bucket, to be drawn dotted. */
  dotted: string;
  /** Only for a one-point series, because a one-point path is invisible. */
  dots: Point[];
}

/**
 * A line from the oldest to the newest bucket, scaled from 0 at the bottom to the largest value
 * at the top. A bucket without a value (`null`) is placed at 0, so the line starts and ends on
 * the bottom line instead of floating. Only the stretches between two real values are solid;
 * every stretch that touches an empty bucket is dotted, because "no command" is not 0 ms.
 */
export function sparklinePath(
  series: readonly (number | null)[],
  { width, height, inset }: SparklineBox,
): Sparkline {
  const values = series.filter((value) => value !== null);
  if (values.length === 0) return { d: "", dotted: "", dots: [] };
  const max = Math.max(0, ...values);
  const step =
    series.length > 1 ? (width - 2 * inset) / (series.length - 1) : 0;
  const toPoint = (value: number, index: number): Point => ({
    x: round(series.length > 1 ? inset + index * step : width / 2),
    y: round(inset + (max > 0 ? 1 - value / max : 1) * (height - 2 * inset)),
  });

  const points = series.map((value, index) => toPoint(value ?? 0, index));
  // A one-point series has no line; a dot keeps it visible.
  if (points.length === 1) return { d: "", dotted: "", dots: points };

  // Consecutive stretches of the same kind share one sub-path.
  const solid: string[] = [];
  const dotted: string[] = [];
  let previousKind: "solid" | "dotted" | null = null;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1] as Point;
    const to = points[index] as Point;
    const real = series[index - 1] !== null && series[index] !== null;
    const kind = real ? "solid" : "dotted";
    const target = real ? solid : dotted;
    if (kind !== previousKind || target.length === 0) {
      target.push(`M ${from.x} ${from.y}`);
    }
    target.push(`L ${to.x} ${to.y}`);
    previousKind = kind;
  }
  return { d: solid.join(" "), dotted: dotted.join(" "), dots: [] };
}
