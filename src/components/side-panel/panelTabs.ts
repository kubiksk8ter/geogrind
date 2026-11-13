import { HistoryTab } from "../history/HistoryTab";
import type { PanelTabDefinition } from "./panelTypes";

/** A further tab is one more item here, its messages "panel.tabs.*" and its content component. */
export const PANEL_TABS: readonly PanelTabDefinition[] = [
  { id: "history", labelKey: "history", Content: HistoryTab },
];
