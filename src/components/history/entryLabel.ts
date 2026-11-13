/** Longer texts are shortened to their first sentence; shorter ones are shown as typed. */
const SHORTEN_ABOVE_LENGTH = 40;
const MIN_SENTENCE_LENGTH = 8;
const SENTENCE_END = /[.!?](?=\s)/;

/**
 * The label of a history entry: for a long text the first sentence followed by an ellipsis
 * ("Show me the Grand Canyon. I do not know where…" becomes "Show me the Grand Canyon…").
 * Without a usable sentence end the text is returned whole and the list cuts it to one line.
 */
export function entryLabel(text: string): string {
  if (text.length <= SHORTEN_ABOVE_LENGTH) return text;
  const end = text.search(SENTENCE_END);
  if (end < MIN_SENTENCE_LENGTH) return text;
  return `${text.slice(0, end).trimEnd()}…`;
}
