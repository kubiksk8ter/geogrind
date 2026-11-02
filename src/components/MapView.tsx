import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { CreateMapEngine } from "@/map";
import { MapFailure } from "./MapFailure";
import { FULL_SCREEN } from "./styles";

export function MapView({ createEngine }: { createEngine: CreateMapEngine }) {
  const t = useTranslations("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (failed || !container) return;

    const engine = createEngine({
      container,
      onFailure: () => setFailed(true),
    });
    return () => engine.destroy();
  }, [createEngine, failed]);

  if (failed) return <MapFailure />;

  return (
    <section className={FULL_SCREEN} aria-label={t("label")}>
      <div className="size-full" ref={containerRef} />
    </section>
  );
}
