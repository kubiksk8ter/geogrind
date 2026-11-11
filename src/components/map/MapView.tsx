import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CreateMapEngine, MapEngine, MapTarget } from "@/map";
import { CommandInput } from "../command-input/CommandInput";
import { LanguageSwitch } from "../language-switch/LanguageSwitch";
import { FULL_SCREEN_CLASS_NAME } from "../sharedConstants";
import { MapFailure } from "./MapFailure";

export function MapView({ createEngine }: { createEngine: CreateMapEngine }) {
  const t = useTranslations("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [engine, setEngine] = useState<MapEngine | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (failed || !container) return;

    const created = createEngine({
      container,
      onFailure: () => setFailed(true),
    });
    setEngine(created);
    return () => {
      setEngine(null);
      created.destroy();
    };
  }, [createEngine, failed]);

  const moveMap = useCallback(
    (target: MapTarget) => {
      // Asked at call time, so a changed system setting applies to the next command.
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      engine?.moveTo(target, reducedMotion ? "jump" : "animate");
    },
    [engine],
  );

  const clearHighlight = useCallback(() => engine?.clearHighlight(), [engine]);

  if (failed) return <MapFailure />;

  return (
    <section className={FULL_SCREEN_CLASS_NAME} aria-label={t("label")}>
      <div className="size-full" ref={containerRef} />
      <CommandInput
        onMoveAction={engine ? moveMap : null}
        onSendAction={clearHighlight}
      />
      {engine && createPortal(<LanguageSwitch />, engine.controlsSlot)}
    </section>
  );
}
