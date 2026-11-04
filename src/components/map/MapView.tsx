import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CreateMapEngine } from "@/map";
import { CommandInput } from "../command-input/CommandInput";
import { LanguageSwitch } from "../language-switch/LanguageSwitch";
import { FULL_SCREEN_CLASS_NAME } from "../sharedConstants";
import { MapFailure } from "./MapFailure";

export function MapView({ createEngine }: { createEngine: CreateMapEngine }) {
  const t = useTranslations("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [controlsSlot, setControlsSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (failed || !container) return;

    const engine = createEngine({
      container,
      onFailure: () => setFailed(true),
    });
    setControlsSlot(engine.controlsSlot);
    return () => {
      setControlsSlot(null);
      engine.destroy();
    };
  }, [createEngine, failed]);

  if (failed) return <MapFailure />;

  return (
    <section className={FULL_SCREEN_CLASS_NAME} aria-label={t("label")}>
      <div className="size-full" ref={containerRef} />
      <CommandInput />
      {controlsSlot && createPortal(<LanguageSwitch />, controlsSlot)}
    </section>
  );
}
