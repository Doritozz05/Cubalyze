"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Search, Puzzle, Plus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";
import { WidgetRegistry } from "@/widgets/WidgetRegistry";
import { validateWidgetPlugin, sanitizeWidgetId } from "@/widgets/loader";
import type { WidgetPlugin } from "@/widgets/sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WidgetExplorerSidebar } from "./WidgetExplorerSidebar";
import { WidgetCard } from "./WidgetCard";
import { getAllWidgets, WIDGET_CATEGORIES } from "@/widgets/registry";
import type { WidgetCategoryId } from "@/widgets/types";

export const EXPLORER_DIALOG_WIDTH = "sm:max-w-[900px]";

export interface WidgetExplorerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Widgets dialog.
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");

  // Reset to "all" + clear search on open
  useEffect(() => {
    if (open) {
      setActiveCategory("all");
      setSearchQuery("");
    }
  }, [open]);

  // Merge built-in + custom widgets via registry. Subscribes to store for live updates.
  const customWidgets = useWidgetStore((s) => s.customWidgets);
  const allWidgets = useMemo(
    () => {
      void customWidgets;
      return getAllWidgets();
    },
    [customWidgets],
  );

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

  const handleOpenImportDialog = useCallback(() => {
    setImportUrl("");
    setImportStatus("idle");
    setImportMessage("");
    setImportDialogOpen(true);
  }, []);

  const handleConfirmImport = useCallback(async () => {
    const url = importUrl.trim();
    if (!url) return;

    setImportStatus("loading");
    setImportMessage("");

    try {
      const module = await import(/* @vite-ignore */ url);
      const plugin = (module.default ?? module) as WidgetPlugin;
      const validation = validateWidgetPlugin(plugin);
      if (!validation.valid) {
        setImportStatus("error");
        setImportMessage(`Invalid widget:\n${validation.errors.join("\n")}`);
        return;
      }

      const safeId = sanitizeWidgetId(plugin.id || plugin.definition?.id);
      if (!safeId) {
        setImportStatus("error");
        setImportMessage("Widget must have a valid id");
        return;
      }

      const definition = {
        ...plugin.definition,
        id: safeId,
        source: "custom" as const,
        icon: plugin.definition.icon as never,
      };

      widgetStore.getState().registerCustomWidget(definition);
      WidgetRegistry.register(safeId, {
        component: plugin.component as unknown as React.ComponentType<Record<string, unknown>>,
        preview: plugin.preview ?? (() => null),
        mapProps: () => ({}),
      });

      setImportStatus("success");
      setImportMessage(`Widget "${definition.name}" imported successfully!`);

      // Close dialog after brief success display
      setTimeout(() => {
        setImportDialogOpen(false);
        setImportStatus("idle");
      }, 1500);
    } catch (err) {
      setImportStatus("error");
      setImportMessage(`Failed to load widget: ${err}`);
    }
  }, [importUrl]);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Below 1024px the dialog is a full-bleed bottom sheet (inset-x-0 +
          bottom-anchored). max-lg:max-w-none! (important) is REQUIRED: the
          base max-w-[calc(100%-2rem)] / sm:max-w-lg / sm:max-w-[900px] would
          otherwise cap the width of the left-anchored sheet (Tailwind emits
          max-lg before sm in the max-w group, so a plain max-lg:max-w-none
          loses to sm:max-w-[900px] on tablets) — leaving an asymmetric gap on
          the right (looked off-center) and clipping the category chips. The !
          is scoped to <1024px, so desktop >=1024px is untouched. */}
      <DialogContent
        className={`${EXPLORER_DIALOG_WIDTH} h-145 max-h-[85vh] overflow-hidden p-0 bg-surface text-ink border-line max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:translate-x-0 max-lg:translate-y-0 max-lg:max-w-none! max-lg:rounded-b-none max-lg:rounded-t-2xl`}
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Widgets</DialogTitle>
        </DialogHeader>

        <div className="flex h-full min-h-0">
          {/* ── Sidebar (desktop only; touch uses scrollable category chips) ── */}
          <div className="hidden lg:block">
            <WidgetExplorerSidebar
              activeCategory={activeCategory}
              onSelectCategory={handleSelectCategory}
            />
          </div>

          {/* ── Main Area ──────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 border-b border-line px-6 py-5 max-lg:px-4 max-lg:py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-ink">
                    <Puzzle className="size-4 text-ink-3" />
                    Widgets
                  </h2>
                  <p className="mt-1 text-[0.78rem] text-ink-3">
                    Discover and toggle optional panels, tools, and visualizers.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Import custom widget */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleOpenImportDialog}
                        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[0.7rem] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        <Plus className="size-3" />
                        Import
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end">Import a custom widget from a URL</TooltipContent>
                  </Tooltip>
                  {/* Count */}
                  <span className="nums shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[0.7rem] text-ink-3">
                    {filteredWidgets.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Category chips — touch only (sidebar is hidden <1024px).
                Wrap instead of scroll so every category is always fully
                visible and nothing gets clipped at the edge. */}
            <div className="shrink-0 border-b border-line/50 px-4 py-2 lg:hidden">
              <div className="flex flex-wrap items-center gap-1.5">
                {WIDGET_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id)}
                    className={cn(
                      "h-8 shrink-0 touch-manipulation rounded-full border px-3 text-xs font-medium transition-colors duration-150 select-none",
                      activeCategory === cat.id
                        ? "border-ink-2/40 bg-surface-2 text-ink"
                        : "border-line bg-surface text-ink-3 hover:text-ink-2",
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search bar */}
            <div className="shrink-0 border-b border-line/50 px-6 py-3 max-lg:px-4">
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
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-lg:px-4">
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

      {/* Import widget dialog — replaces native browser prompt() */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setImportDialogOpen(false);
          setImportStatus("idle");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-ink-3" />
              Import widget
            </DialogTitle>
            <DialogDescription>
              Enter the URL of a widget module to import it into Cubeforge.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <Input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://example.com/my-widget.js"
              className="h-9 text-sm"
              disabled={importStatus === "loading"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && importUrl.trim() && importStatus !== "loading") {
                  handleConfirmImport();
                }
              }}
              autoFocus
            />

            {importStatus === "error" && (
              <div className="flex items-start gap-2 rounded-md bg-dnf-soft px-3 py-2 text-xs text-dnf">
                <AlertCircle className="mt-0.5 size-3 shrink-0" />
                <span className="whitespace-pre-wrap">{importMessage}</span>
              </div>
            )}

            {importStatus === "success" && (
              <div className="flex items-center gap-2 rounded-md bg-ready-soft px-3 py-2 text-xs text-ready">
                <CheckCircle2 className="size-3 shrink-0" />
                <span>{importMessage}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setImportDialogOpen(false);
                setImportStatus("idle");
              }}
              disabled={importStatus === "loading"}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={!importUrl.trim() || importStatus === "loading"}
              className="h-8 gap-1.5 text-xs"
            >
              {importStatus === "loading" ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Plus className="size-3" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
