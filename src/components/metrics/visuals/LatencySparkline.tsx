import { sparklinePath } from "./chartGeometry";

const BOX = { width: 120, height: 32, inset: 2 };

export interface LatencySparklineProps {
  series: readonly (number | null)[];
  /** The text equivalent: median, p95, number of commands and the time span. */
  label: string;
  /** Captions of the axes; the full meaning is in `label`, so they are hidden from readers. */
  axis: { zero: string; start: string; end: string };
}

/** Bucket medians of the hour as a line; stretches next to an empty bucket are dotted. */
export function LatencySparkline({
  series,
  label,
  axis,
}: LatencySparklineProps) {
  const { d, dotted, dots } = sparklinePath(series, BOX);
  const bottom = BOX.height - BOX.inset;

  return (
    <div className="grid w-full grid-cols-[auto_1fr] gap-x-1 gap-y-0.5 text-[10px] leading-none text-neutral-700">
      <div
        aria-hidden="true"
        className="flex h-8 flex-col justify-end text-right tabular-nums"
      >
        <span>{axis.zero}</span>
      </div>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        // Stretched to the full width; strokes keep their width on screen.
        preserveAspectRatio="none"
        className="h-8 w-full text-neutral-900"
      >
        {/* Neutral-500 base line: 3:1 against white, so the zero level stays visible. */}
        <path
          d={`M 0 ${bottom} H ${BOX.width}`}
          stroke="#737373"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {dotted && (
          <path
            d={dotted}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="0.1 3"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        )}
        {d && (
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {dots.map(({ x, y }) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r="1.75"
            fill="currentColor"
          />
        ))}
      </svg>
      <span aria-hidden="true" />
      <div aria-hidden="true" className="flex justify-between">
        <span>{axis.start}</span>
        <span>{axis.end}</span>
      </div>
    </div>
  );
}
