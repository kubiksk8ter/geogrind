const STORAGE_KEY_COOLDOWN = "geogrind.commandCooldownUntil";

/** Epoch milliseconds at which the cooldown ends, or null when none is running. */
export function readCooldownEnd(now: number): number | null {
  try {
    const end = Number(window.localStorage.getItem(STORAGE_KEY_COOLDOWN));
    return Number.isFinite(end) && end > now ? end : null;
  } catch {
    return null;
  }
}

/** Blocked storage only means a reload forgets the cooldown; the server still enforces it. */
export function saveCooldownEnd(end: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_COOLDOWN, String(end));
  } catch {
    // Ignored on purpose, see above.
  }
}
