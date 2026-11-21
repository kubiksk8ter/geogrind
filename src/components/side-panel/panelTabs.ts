import { HistoryTab } from "../history/HistoryTab";
import { MetricsTab } from "../metrics/MetricsTab";
import { TermsTab } from "../terms/TermsTab";
import type { PanelTabDefinition, PanelTabId } from "./panelTypes";

/**
 * A further tab is one more item here, its label in the messages "panel.tabs.<id>" (which also
 * defines PanelTabId) and its content component.
 */
export const PANEL_TABS: readonly PanelTabDefinition[] = [
  { id: "history", Content: HistoryTab },
  { id: "metrics", Content: MetricsTab },
  { id: "terms", Content: TermsTab },
];

export const DEFAULT_PANEL_TAB: PanelTabId = "history";

/** The tab of the given Tabs value, or undefined for an unknown one. */
export function panelTabId(value: unknown): PanelTabId | undefined {
  return PANEL_TABS.find((tab) => tab.id === value)?.id;
}
