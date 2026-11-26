import { type ReactNode, useId } from "react";

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
