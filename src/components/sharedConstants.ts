// Fills the viewport under any circumstances (resize, rotation, mobile address bar).
export const FULL_SCREEN_CLASS_NAME = "fixed inset-0 h-dvh w-dvw";

// Visible keyboard focus that stays readable on white, dark and map backgrounds.
export const FOCUS_RING_CLASS_NAME =
  "focus-visible:outline-3 focus-visible:outline-blue-600";

// Shared easing and reduced-motion opt-out; each component adds its own
// transition-[...] properties and duration. Keep it a complete literal for Tailwind.
export const TRANSITION_CLASS_NAME = "ease-out motion-reduce:transition-none";
