import { type ReactNode, useId } from "react";

// Heading of a metrics group (Application, AI): an icon before the text, in the text colour.
export const GROUP_HEADING_CLASS_NAME =
  "flex items-center gap-1.5 text-base font-semibold text-neutral-900";
export const GROUP_ICON_CLASS_NAME = "size-4 shrink-0";

/** One item of a metrics group: a heading in the shared style and its content. */
export function MetricsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-neutral-900">
        {title}
      </h3>
      {children}
    </section>
  );
}
