import type { IconProps } from "./iconTypes";
import { LineIcon } from "./LineIcon";

/** A clock with a turning-back arrow: past time. */
export function HistoryIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
      <path d="M3.5 4v4.5H8" />
      <path d="M12 7.5V12l3 2" />
    </LineIcon>
  );
}

/** A bar chart on a baseline. */
export function MetricsIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V6M17 16v-7" />
    </LineIcon>
  );
}

/** A sheet with a folded corner and lines of text. */
export function TermsIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M14 3H6.5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V7.5Z" />
      <path d="M14 3v4.5h4.5" />
      <path d="M9 12.5h6M9 16.5h6" />
    </LineIcon>
  );
}
