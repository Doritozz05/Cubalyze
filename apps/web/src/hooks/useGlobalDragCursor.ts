"use client";

import { useEffect } from "react";

/**
 * Pins `cursor: grabbing` on <html> for the duration of a drag.
 *
 * The CSS cursor follows the element UNDER the pointer — not the element
 * being dragged. Dragging pointer-events-none clones (e.g. the dock pill's
 * lifted preview) would otherwise flip the cursor back to default/pointer
 * as soon as the pointer leaves the original element (e.g. over the timer).
 * This toggles the `.drag-grabbing` class on <html> (see index.css), which
 * forces a grabbing hand everywhere for the whole drag.
 *
 * Cleanup-based: the class is removed when `isDragging` flips to false AND
 * when the component unmounts mid-drag (otherwise the cursor would stay
 * stuck grabbing forever).
 */
export function useGlobalDragCursor(isDragging: boolean): void {
  useEffect(() => {
    if (isDragging) {
      document.documentElement.classList.add("drag-grabbing");
      return () => document.documentElement.classList.remove("drag-grabbing");
    }
  }, [isDragging]);
}
