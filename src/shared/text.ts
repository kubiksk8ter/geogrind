export const MAX_COMMAND_LENGTH = 200;

// Control, format (zero-width, bidi), line/paragraph separator, private-use, unassigned and
// lone surrogate characters are never legitimate in a place command.
const FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}\p{Cs}]/gu;
const LINE_BREAKS_AND_TABS = /[\t\n\v\f\r]/g;
const WHITESPACE_RUNS = /\s+/gu;

/** The one canonical form of user text; the browser applies it, the server only compares. */
export function normalizeText(raw: string, maxLength: number): string {
  const collapsed = raw
    .replace(LINE_BREAKS_AND_TABS, " ")
    .replace(FORBIDDEN_CHARACTERS, "")
    .normalize("NFC")
    .replace(WHITESPACE_RUNS, " ")
    .trim();
  return Array.from(collapsed).slice(0, maxLength).join("").trimEnd();
}

/** True for non-empty text that normalisation would not change. */
export function isCleanText(text: string, maxLength: number): boolean {
  return text !== "" && normalizeText(text, maxLength) === text;
}

export function normalizeCommandText(raw: string): string {
  return normalizeText(raw, MAX_COMMAND_LENGTH);
}

export function isCleanCommandText(text: string): boolean {
  return isCleanText(text, MAX_COMMAND_LENGTH);
}
