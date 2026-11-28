import type { ReactNode } from "react";
import type { IconProps } from "./iconTypes";

/** Base of the line icons: one style, drawn in the current text colour, hidden from AT. */
export function LineIcon({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
