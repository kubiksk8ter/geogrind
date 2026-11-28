import type { ComponentType } from "react";
import type { CommandResult } from "@/shared/actions";
import type messages from "../../../messages/cs.json";
import type { IconProps } from "../icons/iconTypes";

export interface PanelTabContentProps {
  /** Null while the map is not ready. */
  showResult: ((result: CommandResult) => void) | null;
  /** Called after an activation; the panel closes itself on small screens only. */
  onActivated(): void;
}

/** Also the key of the tab's label in the messages "panel.tabs". */
export type PanelTabId = keyof typeof messages.panel.tabs;

export interface PanelTabDefinition {
  id: PanelTabId;
  /** Shown in front of the label. */
  Icon: ComponentType<IconProps>;
  Content: ComponentType<PanelTabContentProps>;
}

/** Also the key of the link's tooltip and accessible name in the messages "panel.links". */
export type PanelLinkId = keyof typeof messages.panel.links;

export interface PanelLinkDefinition {
  id: PanelLinkId;
  href: string;
  Mark: ComponentType<IconProps>;
  /** Size of the mark, so that marks of different shapes look equally large. */
  markClassName: string;
}
