import { clsx } from "clsx";
import type {
  ComponentPropsWithoutRef,
  KeyboardEvent,
  ReactNode,
} from "react";
import { useId, useRef } from "react";

import { getSectionTabId, getSectionTabPanelId } from "./section-tabs-ids";
import { resolveActiveTabId } from "./section-tabs-utils";

export interface SectionTabItem<TId extends string = string> {
  badge?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  id: TId;
  label: string;
}

export interface SectionTabsProps<TId extends string = string>
  extends Omit<
    ComponentPropsWithoutRef<"div">,
    "aria-label" | "children" | "dir" | "onChange" | "role"
  > {
  /** Pass the ID resolved by `resolveActiveTabId` in the owning component. */
  activeId: TId | undefined;
  ariaLabel: string;
  dir?: "ltr" | "rtl";
  items: readonly SectionTabItem<TId>[];
  onChange: (id: TId) => void;
}

export function SectionTabs<TId extends string>({
  activeId,
  ariaLabel,
  className,
  dir = "rtl",
  id,
  items,
  onChange,
  ...props
}: SectionTabsProps<TId>) {
  const generatedId = useId().replaceAll(":", "");
  const tabsId = id ?? `section-tabs-${generatedId}`;
  const tabRefs = useRef(new Map<TId, HTMLButtonElement>());
  const resolvedActiveId = resolveActiveTabId(items, activeId);

  if (resolvedActiveId !== undefined && resolvedActiveId !== activeId) {
    throw new Error(
      `SectionTabs received invalid activeId "${activeId ?? "undefined"}". ` +
        "Call resolveActiveTabId(items, requestedId) in the owner and use its " +
        "result for both SectionTabs.activeId and panel rendering.",
    );
  }

  function handleKeyboardNavigation(
    event: KeyboardEvent<HTMLButtonElement>,
    currentId: TId,
  ) {
    const isArrowKey =
      event.key === "ArrowLeft" || event.key === "ArrowRight";
    if (!isArrowKey && event.key !== "Home" && event.key !== "End") return;

    const enabledItems = items.filter((item) => !item.disabled);
    if (enabledItems.length === 0) return;

    const currentIndex = enabledItems.findIndex((item) => item.id === currentId);
    let target: SectionTabItem<TId> | undefined;

    if (event.key === "Home") {
      target = enabledItems[0];
    } else if (event.key === "End") {
      target = enabledItems.at(-1);
    } else if (currentIndex !== -1 && enabledItems.length > 1) {
      const movesForward =
        dir === "rtl" ? event.key === "ArrowLeft" : event.key === "ArrowRight";
      const offset = movesForward ? 1 : -1;
      const targetIndex =
        (currentIndex + offset + enabledItems.length) % enabledItems.length;
      target = enabledItems[targetIndex];
    }

    if (!target) return;

    event.preventDefault();
    tabRefs.current.get(target.id)?.focus();
    onChange(target.id);
  }

  return (
    <div
      {...props}
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={clsx(
        "subtle-scrollbar flex max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain rounded-sm bg-surface-subtle p-1",
        className,
      )}
      dir={dir}
      id={tabsId}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.id === resolvedActiveId;

        return (
          <button
            aria-controls={getSectionTabPanelId(tabsId, item.id)}
            aria-disabled={item.disabled || undefined}
            aria-selected={isActive}
            className={clsx(
              "flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xs px-3 text-sm whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
              isActive
                ? "bg-surface font-bold text-primary-ink"
                : "font-medium text-muted hover:bg-surface/70 hover:text-ink",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={item.disabled}
            id={getSectionTabId(tabsId, item.id)}
            key={item.id}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyboardNavigation(event, item.id)}
            ref={(node) => {
              if (node) {
                tabRefs.current.set(item.id, node);
              } else {
                tabRefs.current.delete(item.id);
              }
            }}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            type="button"
          >
            {item.icon != null ? (
              <span aria-hidden="true" className="shrink-0">
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
            {item.badge != null ? (
              <>
                {" "}
                <span className="shrink-0 text-xs">{item.badge}</span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
