import type { ComponentType } from "react";
import type { CommandResult } from "@/shared/actions";
import type messages from "../../../messages/cs.json";

export interface PanelTabContentProps {
  /** Null while the map is not ready. */
  showResult: ((result: CommandResult) => void) | null;
  /** Called after an activation; the panel closes itself on small screens only. */
  onActivated(): void;
}

export interface PanelTabDefinition {
  id: string;
  /** Key in the messages "panel.tabs". */
  labelKey: keyof typeof messages.panel.tabs;
  Content: ComponentType<PanelTabContentProps>;
}
