const ENABLED_TEXT_INPUT = 'input[type="text"]:not(:disabled)';
const TABBABLE =
  'input:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Where focus goes when the notice closes without opening the panel: the command input, or the
 * first control in `root` while the input is paused (disabled) or not there yet.
 */
export function focusTargetAfterNotice(
  root: HTMLElement | null,
): HTMLElement | null {
  if (!root) return null;
  return (
    root.querySelector<HTMLElement>(ENABLED_TEXT_INPUT) ??
    root.querySelector<HTMLElement>(TABBABLE)
  );
}
