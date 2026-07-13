function encodeIdPart(id: string): string {
  return encodeURIComponent(id);
}

export function getSectionTabId(tabsId: string, tabId: string): string {
  return `${tabsId}-tab-${encodeIdPart(tabId)}`;
}

export function getSectionTabPanelId(tabsId: string, tabId: string): string {
  return `${tabsId}-panel-${encodeIdPart(tabId)}`;
}
