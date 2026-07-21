"use client";

import { motion, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import { WIDGET_CATEGORIES, type WidgetCategory, type WidgetCategoryId } from "@/widgets/registry";

export const EXPLORER_SIDEBAR_WIDTH = 200;

export interface WidgetExplorerSidebarProps {
  activeCategory: WidgetCategoryId;
  onSelectCategory: (id: WidgetCategoryId) => void;
}

export function WidgetExplorerSidebar({
  activeCategory,
  onSelectCategory,
}: WidgetExplorerSidebarProps) {
  return (
    <nav
      className="flex shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-canvas px-2 py-3"
      style={{ width: EXPLORER_SIDEBAR_WIDTH }}
    >
      <p className="mb-2 px-3 text-[0.65rem] font-medium uppercase tracking-[0.15em] text-ink-3 select-none">
        Categories
      </p>

      <LayoutGroup>
        {WIDGET_CATEGORIES.map((cat) => (
          <CategoryItem
            key={cat.id}
            category={cat}
            isActive={activeCategory === cat.id}
            onSelect={() => onSelectCategory(cat.id)}
          />
        ))}
      </LayoutGroup>
    </nav>
  );
}

function CategoryItem({
  category,
  isActive,
  onSelect,
}: {
  category: WidgetCategory;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.82rem] transition-colors duration-150",
        isActive
          ? "text-ink"
          : "text-ink-3 hover:bg-surface hover:text-ink-2",
      )}
    >
      {isActive && (
        <motion.div
          layoutId="explorer-active-bg"
          className="absolute inset-0 rounded-lg bg-surface"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative z-10 truncate">{category.label}</span>
    </button>
  );
}
