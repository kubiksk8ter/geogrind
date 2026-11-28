import type { IconProps } from "./iconTypes";
import { LineIcon } from "./LineIcon";

/** An application window with a title bar: the Application metrics group. */
export function AppWindowIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <rect x="2" y="3.5" width="20" height="17" rx="2" />
      <path d="M2 8h20" />
      <path d="M6.5 5.75h.01M9.5 5.75h.01" />
    </LineIcon>
  );
}

/** A large and a small four-pointed sparkle: the AI metrics group. */
export function SparklesIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M10 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z" />
      <path d="M18 14.5c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z" />
    </LineIcon>
  );
}
