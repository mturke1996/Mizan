interface ResolvableTab<TId extends string> {
  readonly disabled?: boolean;
  readonly id: TId;
}

/**
 * Resolve the selection in the owning component before rendering.
 *
 * Use the returned ID for both `SectionTabs.activeId` and the visible tab panel
 * so the controlled tabs and caller-owned panel cannot diverge.
 */
export function resolveActiveTabId<TId extends string>(
  items: readonly ResolvableTab<TId>[],
  requestedId: TId | undefined,
): TId | undefined {
  if (
    requestedId !== undefined &&
    items.some((item) => item.id === requestedId && !item.disabled)
  ) {
    return requestedId;
  }

  return items.find((item) => !item.disabled)?.id;
}
