"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Search, LayoutGrid, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsTouch } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useWidgetStore } from "@/widgets/widgetStore";
import { getAllDockItems, type DockItemKind } from "@/widgets/dock/dockRegistry";
import { DockItemCard } from "./DockItemCard";

export const DOCK_EXPLORER_WIDTH = "sm:max-w-[900px]";

export interface DockExplorerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KIND_CATEGORIES: { id: DockItemKind | "all"; label: string }[] = [
  { id: "all", label: "dock.explorer.allKinds" },
  { id: "widget", label: "dock.explorer.kindWidget" },
  { id: "clock", label: "dock.explorer.kindClock" },
  { id: "profile", label: "dock.explorer.kindProfile" },
  { id: "spacer", label: "dock.explorer.kindSpacer" },
];

/**
 * Dock Explorer dialog — visually identical to WidgetExplorer.
 * Users can browse all dockable items (widgets + system pieces) and add
 * them to the dock with a single click.
 */
export function DockExplorer({ open, onOpenChange }: DockExplorerProps) {
  const { t } = useTranslation("dock");
  const isTouch = useIsTouch();
  const [activeKind, setActiveKind] = useState<DockItemKind | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const dockItems = useWidgetStore((s) => s.dockItems);

  useEffect(() => {
    if (open) {
      setActiveKind("all");
      setSearchQuery("");
    }
  }, [open]);

  const allItems = useMemo(() => getAllDockItems(), []);

  const filteredItems = useMemo(() => {
    let list = allItems;
    if (activeKind !== "all") {
      list = list.filter((item) => item.kind === activeKind);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          t(item.labelKey).toLowerCase().includes(q) ||
          item.kind.toLowerCase().includes(q),
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, activeKind, searchQuery]);

  const handleSelectKind = useCallback((id: DockItemKind | "all") => {
    setActiveKind(id);
  }, []);

  const innerContent = (
    <div className="flex h-full min-h-0">
      {/* Sidebar (desktop) */}
      <div className="hidden lg:flex h-full shrink-0">
        <div className="flex h-full w-44 flex-col border-r border-line bg-surface-2/30 p-2">
          <div className="px-2 pb-2 text-[0.68rem] font-medium uppercase tracking-wider text-ink-3">
            {t("explorer.categories")}
          </div>
          {KIND_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleSelectKind(cat.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.82rem] transition-colors",
                activeKind === cat.id
                  ? "bg-surface font-medium text-ink shadow-xs"
                  : "text-ink-2 hover:bg-surface hover:text-ink",
              )}
            >
              <span className="truncate">{t(cat.label)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-line px-6 py-5 max-lg:px-4 max-lg:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-ink">
                <LayoutGrid className="size-4 text-ink-3" />
                {t("explorer.title")}
              </h2>
              <p className="mt-1 text-[0.78rem] text-ink-3">
                {t("explorer.subtitle")}
              </p>
            </div>
            <span className="nums shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[0.7rem] text-ink-3">
              {filteredItems.length}
            </span>
          </div>
        </div>

        {/* Kind dropdown (touch) */}
        <div className="shrink-0 border-b border-line/60 px-4 py-2.5 lg:hidden">
          <Select
            value={activeKind}
            onValueChange={(val) => handleSelectKind(val as DockItemKind | "all")}
          >
            <SelectTrigger className="h-9 w-full max-w-60 gap-2 rounded-lg border border-line bg-surface-2 px-3 text-xs font-semibold text-ink shadow-xs">
              <div className="flex items-center gap-2 truncate">
                <Filter className="size-3.5 shrink-0 text-ink-3" />
                <span className="text-ink-3 font-normal">{t("explorer.kind")}</span>
                <SelectValue placeholder={t("explorer.kindPlaceholder")} />
              </div>
            </SelectTrigger>
            <SelectContent side="bottom" align="start">
              {KIND_CATEGORIES.map((cat) => (
                <SelectItem key={cat.id} value={cat.id} className="text-xs">
                  <span className="font-medium">{t(cat.label)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="shrink-0 border-b border-line/50 px-6 py-3 max-lg:px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("explorer.searchPlaceholder")}
              className={cn(
                "nums h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[0.82rem] text-ink outline-none",
                "placeholder:text-ink-3/50",
                "focus:border-ink-2/40 focus:ring-1 focus:ring-ink-2/20",
                "transition-colors duration-150",
              )}
            />
          </div>
        </div>

        {/* Card grid */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-lg:px-4">
          {filteredItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <LayoutGrid className="size-8 text-ink-3/30" />
              <p className="text-sm text-ink-2">{t("explorer.noResults")}</p>
              <p className="text-xs text-ink-3">{t("explorer.noResultsHint")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredItems.map((item) => (
                <DockItemCard
                  key={item.id}
                  item={item}
                  inDock={dockItems.includes(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return isTouch ? (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-surface text-ink border-line rounded-t-2xl max-h-[85vh] h-[85vh] p-0 pb-safe focus:outline-none">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{t("explorer.title")}</DrawerTitle>
        </DrawerHeader>
        {innerContent}
      </DrawerContent>
    </Drawer>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${DOCK_EXPLORER_WIDTH} h-145 max-h-[85vh] overflow-hidden p-0 bg-surface text-ink border-line`}
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("explorer.title")}</DialogTitle>
        </DialogHeader>
        {innerContent}
      </DialogContent>
    </Dialog>
  );
}
