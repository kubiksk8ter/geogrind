"use client";

import { Drawer } from "@base-ui/react/drawer";
import { Tabs } from "@base-ui/react/tabs";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import {
  LARGE_SCREEN_QUERY,
  MAP_CONTROL_CLASS_NAME,
  MAP_CONTROL_FOCUS_CLASS_NAME,
  MAP_CONTROL_FOCUS_INSET_CLASS_NAME,
  SIDE_PANEL_WIDTH_CLASS_NAME,
  TRANSITION_CLASS_NAME,
} from "../sharedConstants";
import { PANEL_TABS } from "./panelTabs";
import type { PanelTabContentProps } from "./panelTypes";
import { useMediaQuery } from "./useMediaQuery";

export interface SidePanelProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Where the open control goes (the map's control stack); without it there is no control. */
  controlSlot: HTMLElement | null;
  showResult: PanelTabContentProps["showResult"];
}

/**
 * Tabbed panel on the right edge. Full screen and modal below 768 px; from 768 px a side panel
 * that does not block the map (the caller narrows the map while it is open).
 */
export function SidePanel({
  open,
  onOpenChange,
  controlSlot,
  showResult,
}: SidePanelProps) {
  const t = useTranslations("panel");
  const large = useMediaQuery(LARGE_SCREEN_QUERY);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      modal={!large}
      swipeDirection="right"
      // Beside the map a click or focus move into the map is work with the map, not a dismissal.
      disablePointerDismissal
    >
      {controlSlot &&
        createPortal(
          <Drawer.Trigger
            aria-label={t("open")}
            // Native browser tooltip, like the map's zoom buttons.
            title={t("title")}
            // The visible 29 px button matches the other map controls; the pseudo-element
            // enlarges its touch target to 44 px.
            className={`relative mt-2.5 grid size-7.25 cursor-pointer place-items-center bg-white! text-neutral-900 transition-[background-color,box-shadow] duration-300 hover:bg-neutral-100! ${MAP_CONTROL_CLASS_NAME} ${MAP_CONTROL_FOCUS_CLASS_NAME} ${TRANSITION_CLASS_NAME} after:absolute after:-inset-2 after:content-['']`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Drawer.Trigger>,
          controlSlot,
        )}
      <Drawer.Portal>
        {/* The viewport enables swipe handling; it must not catch clicks meant for the map. */}
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-10">
          <Drawer.Popup
            aria-label={t("title")}
            className={`pointer-events-auto fixed top-0 right-0 z-10 flex h-dvh w-dvw ${SIDE_PANEL_WIDTH_CLASS_NAME} translate-x-(--drawer-swipe-movement-x,0px) flex-col bg-white text-neutral-900 shadow-xl ring-1 ring-neutral-500 transition-transform duration-300 data-swiping:transition-none data-ending-style:translate-x-full data-starting-style:translate-x-full ${TRANSITION_CLASS_NAME}`}
          >
            <PanelTabs
              showResult={showResult}
              onActivated={() => {
                if (!large) onOpenChange(false);
              }}
            />
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function PanelTabs(props: PanelTabContentProps) {
  const t = useTranslations("panel");

  return (
    <Tabs.Root
      defaultValue={PANEL_TABS[0]?.id}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-stretch justify-between border-b border-neutral-300">
        <Tabs.List aria-label={t("tabsLabel")} className="flex">
          {PANEL_TABS.map((tab) => (
            <Tabs.Tab
              key={tab.id}
              value={tab.id}
              className={`min-h-11 cursor-pointer px-4 text-sm font-semibold text-neutral-900 data-active:bg-neutral-900 data-active:text-white transition-[background-color,color,box-shadow] duration-300 ${MAP_CONTROL_FOCUS_INSET_CLASS_NAME} ${TRANSITION_CLASS_NAME}`}
            >
              {t(`tabs.${tab.labelKey}`)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Drawer.Close
          aria-label={t("close")}
          className={`grid size-11 cursor-pointer place-items-center text-neutral-900 transition-shadow duration-300 ${MAP_CONTROL_FOCUS_INSET_CLASS_NAME} ${TRANSITION_CLASS_NAME}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Drawer.Close>
      </div>
      {PANEL_TABS.map((tab) => (
        <Tabs.Panel
          key={tab.id}
          value={tab.id}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <tab.Content {...props} />
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
