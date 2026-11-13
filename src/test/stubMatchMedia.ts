import { vi } from "vitest";

/** Replaces `window.matchMedia`; the screen size and the motion preference can be changed later. */
export function stubMatchMedia(
  initial: { large?: boolean; reducedMotion?: boolean } = {},
) {
  const state = { large: false, reducedMotion: false, ...initial };
  const listeners = new Set<() => void>();
  const matches = (query: string) => {
    if (query.includes("min-width")) return state.large;
    if (query.includes("prefers-reduced-motion")) return state.reducedMotion;
    return false;
  };
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return matches(query);
    },
    addEventListener: (_type: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  return {
    setLarge(large: boolean) {
      state.large = large;
      for (const listener of listeners) listener();
    },
  };
}
