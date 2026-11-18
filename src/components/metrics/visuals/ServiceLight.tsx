import type { ServiceState } from "../appMetricsViewHelper";

export interface ServiceLightProps {
  state: ServiceState;
  /** The state as text: the native title and the accessible name of the light. */
  title: string;
}

// A highlight in the upper left and a darker lower edge make the dot read as an LED; a soft glow
// of its own colour is added for the two known states.
const LED_CLASS_NAME =
  "bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.75),rgba(255,255,255,0)_55%)]";
const DOT_CLASS_NAME: Record<ServiceState, string> = {
  available: `bg-green-700 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.35),0_0_5px_rgba(21,128,61,0.6)] ${LED_CLASS_NAME}`,
  unavailable: `bg-red-700 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.35),0_0_5px_rgba(185,28,28,0.6)] ${LED_CLASS_NAME}`,
  unknown: `bg-neutral-400 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.25)] ${LED_CLASS_NAME}`,
};

/** A dot like an LED: green when available, red when not, grey while unknown. */
export function ServiceLight({ state, title }: ServiceLightProps) {
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={`inline-block size-3 shrink-0 rounded-full forced-color-adjust-none ${DOT_CLASS_NAME[state]}`}
    />
  );
}
