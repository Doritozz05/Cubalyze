"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Search, Puzzle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { WidgetExplorerSidebar, EXPLORER_SIDEBAR_WIDTH } from "./WidgetExplorerSidebar";
import { WidgetCard } from "./WidgetCard";
import { getAllWidgets } from "@/widgets/registry";
import type { WidgetCategoryId } from "@/widgets/types";

export const EXPLORER_DIALOG_WIDTH = "sm:max-w-[900px]";

export interface WidgetExplorerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Widget Explorer dialog.
 *
 * A clean, minimal panel (matching the Settings dialog aesthetic) where
 * users can discover, preview, and toggle built-in (and future community)
 * widgets on and off.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │  Categories  │   Search...                   │
 *   │  ──────────  │  ┌─────┐ ┌─────┐ ┌─────┐    │
 *   │  ● All       │  │Times│ │2D   │ │3D   │    │
 *   │    Visual... │  │Log  │ │Net  │ │Cube │    │
 *   │    Timer     │  └─────┘ └─────┘ └─────┘    │
 *   │    Analysis  │  ┌─────┐ ┌─────┐            │
 *   │    Training  │  │Stats│ │Next │            │
 *   │              │  └─────┘ └─────┘            │
 *   └─────────────────────────────────────────────┘
 */
export function WidgetExplorer({ open, onOpenChange }: WidgetExplorerProps) {
  const [activeCategory, setActiveCategory] = useState<WidgetCategoryId>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Reset to "all" + clear search on open
  useEffect(() => {
    if (open) {
      setActiveCategory("all");
      setSearchQuery("");
    }
  }, [open]);

  const allWidgets = useMemo(() => getAllWidgets(), []);

  const filteredWidgets = useMemo(() => {
    let list = allWidgets;

    // Filter by category
    if (activeCategory !== "all") {
      list = list.filter((w) => w.category === activeCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [allWidgets, activeCategory, searchQuery]);

  const handleSelectCategory = useCallback((id: WidgetCategoryId) => {
    setActiveCategory(id);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${EXPLORER_DIALOG_WIDTH} h-145 max-h-[85vh] overflow-hidden p-0`}
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Widget Explorer</DialogTitle>
        </DialogHeader>

        <div className="flex h-full min-h-0">
          {/* ── Sidebar ────────────────────────────────────────────────── */}
          <WidgetExplorerSidebar
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
          />

          {/* ── Main Area ──────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 border-b border-line px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-ink">
                    <Puzzle className="size-4 text-ink-3" />
                    Widget Explorer
                  </h2>
                  <p className="mt-1 text-[0.78rem] text-ink-3">
                    Discover and toggle optional panels, tools, and visualizers.
                  </p>
                </div>

                {/* Count */}
                <span className="nums shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[0.7rem] text-ink-3">
                  {filteredWidgets.length}
                </span>
              </div>
            </div>

            {/* Search bar */}
            <div className="shrink-0 border-b border-line/50 px-6 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search widgets..."
                  className={cn(
                    "nums h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[0.82rem] text-ink outline-none",
                    "placeholder:text-ink-3/50",
                    "focus:border-ink-2/40 focus:ring-1 focus:ring-ink-2/20",
                    "transition-colors duration-150",
                  )}
                />
              </div>
            </div>

            {/* Widget grid */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {filteredWidgets.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <Puzzle className="size-8 text-ink-3/30" />
                  <p className="text-sm text-ink-2">No widgets found</p>
                  <p className="text-xs text-ink-3">
                    Try a different category or search term.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredWidgets.map((widget) => (
                    <WidgetCard key={widget.id} widget={widget} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
