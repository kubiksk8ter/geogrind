import type { IconProps } from "./iconTypes";
import { LineIcon } from "./LineIcon";

/** A closed envelope: the e-mail link. */
export function MailIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </LineIcon>
  );
}
