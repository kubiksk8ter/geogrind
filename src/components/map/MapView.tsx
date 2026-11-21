import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  CreateMapEngine,
  MapAvailability,
  MapEngine,
  MapTarget,
} from "@/map";
import { CommandInput } from "../command-input/CommandInput";
import { useHistoryStore } from "../history/store/HistoryStoreProvider";
import { LanguageSwitch } from "../language-switch/LanguageSwitch";
import {
  FULL_SCREEN_CLASS_NAME,
  MAP_BESIDE_PANEL_CLASS_NAME,
} from "../sharedConstants";
import { DEFAULT_PANEL_TAB } from "../side-panel/panelTabs";
import type { PanelTabId } from "../side-panel/panelTypes";
import { SidePanel } from "../side-panel/SidePanel";
import { focusTargetAfterNotice } from "../terms/focusAfterNotice";
import { TermsNotice } from "../terms/TermsNotice";
import { MapFailure } from "./MapFailure";
import { MapAvailabilityContext } from "./mapAvailability";

export function MapView({ createEngine }: { createEngine: CreateMapEngine }) {
  const t = useTranslations("map");
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [engine, setEngine] = useState<MapEngine | null>(null);
  const [availability, setAvailability] = useState<MapAvailability>("unknown");
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTabId>(DEFAULT_PANEL_TAB);
  const addEntry = useHistoryStore((state) => state.addEntry);
  const setCommandInFlight = useHistoryStore(
    (state) => state.setCommandInFlight,
  );

  useEffect(() => {
    const container = containerRef.current;
    if (failed || !container) return;

    const created = createEngine({
      container,
      onFailure: () => setFailed(true),
      onAvailabilityChange: setAvailability,
    });
    setEngine(created);
    return () => {
      setEngine(null);
      // A new engine starts without knowing whether tiles load.
      setAvailability("unknown");
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

  const openTerms = useCallback(() => {
    setActiveTab("terms");
    setPanelOpen(true);
  }, []);

  const focusTargetOnNoticeClose = useCallback(
    () => focusTargetAfterNotice(sectionRef.current),
    [],
  );

  if (failed) return <MapFailure />;

  return (
    <section
      ref={sectionRef}
      className={`${FULL_SCREEN_CLASS_NAME} ${panelOpen ? MAP_BESIDE_PANEL_CLASS_NAME : ""}`}
      aria-label={t("label")}
    >
      <div className="size-full" ref={containerRef} />
      <CommandInput
        onMoveAction={engine ? moveMap : null}
        onSendAction={clearHighlight}
        onSuccessAction={addEntry}
        onRequestRunningChangeAction={setCommandInFlight}
      />
      {engine && createPortal(<LanguageSwitch />, engine.controlsSlot)}
      <MapAvailabilityContext value={availability}>
        <SidePanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          controlSlot={engine?.controlsSlot ?? null}
          showResult={engine ? moveMap : null}
        />
      </MapAvailabilityContext>
      <TermsNotice
        onOpenTerms={openTerms}
        focusTargetOnClose={focusTargetOnNoticeClose}
      />
    </section>
  );
}
