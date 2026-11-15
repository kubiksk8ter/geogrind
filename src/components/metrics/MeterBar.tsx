import { Meter } from "@base-ui/react/meter";
import { TRANSITION_CLASS_NAME } from "../sharedConstants";

export interface MeterBarProps {
  label: string;
  value: number;
  max: number;
  /** The figure as text beside the bar, so the meaning never rests on the bar alone. */
  display: string;
  /** Text equivalent for assistive technology. */
  ariaValueText: string;
}

/** A labelled bar with `role="meter"`; the caller decides that the figures are known. */
export function MeterBar({
  label,
  value,
  max,
  display,
  ariaValueText,
}: MeterBarProps) {
  return (
    <Meter.Root
      value={Math.min(Math.max(value, 0), max)}
      min={0}
      max={max}
      getAriaValueText={() => ariaValueText}
      className="flex flex-col gap-1"
    >
      <div className="flex items-baseline justify-between gap-2">
        <Meter.Label className="text-neutral-900">{label}</Meter.Label>
        <span className="shrink-0 font-semibold text-neutral-900">
          {display}
        </span>
      </div>
      {/* Neutral-500 outline: 3:1 against white; the dark fill against the light track as well. */}
      <Meter.Track className="h-2 overflow-hidden rounded-full bg-neutral-200 ring-1 ring-neutral-500 forced-colors:bg-[Canvas]">
        <Meter.Indicator
          className={`rounded-full bg-neutral-900 transition-[width] duration-300 forced-colors:bg-[Highlight] ${TRANSITION_CLASS_NAME}`}
        />
      </Meter.Track>
    </Meter.Root>
  );
}
