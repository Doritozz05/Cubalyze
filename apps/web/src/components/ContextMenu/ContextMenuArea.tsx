"use client";

import { useCallback, type ReactNode } from "react";
import { contextMenuStore, type ContextMenuItem } from "./contextMenuStore";

// ── Generic items shown in EVERY right-click ────────────────────────────

let _genericItems: ContextMenuItem[] = [];

/**
 * Register the generic context-menu items (shown in every view).
 * Call once at app init (from AppShell).
 */
export function setGenericContextItems(items: ContextMenuItem[]) {
  _genericItems = items;
}

// ── ContextMenuArea ────────────────────────────────────────────────────

/**
 * Wraps a region of the UI so that right-clicking opens a context menu.
 *
 * - `items` are view-specific (e.g. the dock adds "Editar dock…").
 * - Generic items (set via setGenericContextItems) are always appended
 *   at the end, separated by a divider.
 */
export function ContextMenuArea({
  items = [],
  children,
  className,
}: {
  items?: ContextMenuItem[];
  children: ReactNode;
  className?: string;
}) {
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Merge: view-specific items first, then a separator, then generic.
      const all: ContextMenuItem[] = [
        ...items,
        ...(_genericItems.length > 0 && items.length > 0
          ? [{ id: "__sep__", label: "", separatorBefore: true }]
          : []),
        ..._genericItems,
      ];
      contextMenuStore.open(e.clientX, e.clientY, all);
    },
    [items],
  );

  return (
    <div onContextMenu={handleContextMenu} className={className}>
      {children}
    </div>
  );
}
