import type { ComponentType } from "react";
import type { CommandResult } from "@/shared/actions";
import type messages from "../../../messages/cs.json";

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
  Content: ComponentType<PanelTabContentProps>;
}
