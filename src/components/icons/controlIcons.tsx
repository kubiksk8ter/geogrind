import type { IconProps } from "./iconTypes";
import { LineIcon } from "./LineIcon";

/** Three lines: opens the side panel. */
export function MenuIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </LineIcon>
  );
}

/** A cross: closes the side panel. */
export function CloseIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </LineIcon>
  );
}

/** A quarter arc on a faint ring; the caller animates it. */
export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
