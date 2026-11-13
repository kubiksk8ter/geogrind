// Fills the viewport under any circumstances (resize, rotation, mobile address bar).
export const FULL_SCREEN_CLASS_NAME = "fixed inset-0 h-dvh w-dvw";

// Every interactive control has MapLibre's light-blue glow on keyboard focus and on mouse hover
// (not when disabled); the control adds its own
// transition-[...box-shadow] so that the glow fades in. Forced colours get an outline instead.
// Controls in the map's control stack also look like MapLibre's zoom buttons: 4px corners and a
// faint 2px halo (forced colours: system colour).
export const MAP_CONTROL_CLASS_NAME =
  "rounded-sm shadow-[0_0_0_2px_rgb(0_0_0/0.1)] forced-colors:shadow-[0_0_0_2px_ButtonText]";
export const MAP_CONTROL_FOCUS_CLASS_NAME =
  "outline-none focus-visible:relative focus-visible:z-10 focus-visible:shadow-[0_0_2px_2px_#0096ff] not-disabled:hover:relative not-disabled:hover:z-10 not-disabled:hover:shadow-[0_0_2px_2px_#0096ff] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:-outline-offset-2";
// The same glow drawn inside, for controls that touch the edge of a clipping container (panel
// tabs, close button, history list), where an outer glow would be cut off.
export const MAP_CONTROL_FOCUS_INSET_CLASS_NAME =
  "outline-none focus-visible:shadow-[inset_0_0_2px_2px_#0096ff] not-disabled:hover:shadow-[inset_0_0_2px_2px_#0096ff] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:-outline-offset-2";

// Shared easing and reduced-motion opt-out; each component adds its own
// transition-[...] properties and duration. Keep it a complete literal for Tailwind.
export const TRANSITION_CLASS_NAME = "ease-out motion-reduce:transition-none";
