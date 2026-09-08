"use client";

import { memo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeHex } from "./colorUtils";

interface SwatchGridProps {
  colors: readonly string[];
  /** Canonical external value — marks the active swatch. */
  selectedHex: string;
  onSelect: (hex: string) => void;
  /** When present, each swatch gets a delete button (favorites). */
  onRemove?: (hex: string) => void;
  removeLabel?: string;
  /** Hover/keyboard focus reports the hex so the footer can preview it. */
  onHoverHex?: (hex: string | null) => void;
}

/**
 * Plain button grid — deliberately no per-swatch Tooltip: mounting dozens of
 * Radix roots was the main open-popover cost. The hovered hex surfaces in
 * the footer instead (Figma/DevTools behavior).
 */
export const SwatchGrid = memo(function SwatchGrid({
  colors,
  selectedHex,
  onSelect,
  onRemove,
  removeLabel,
  onHoverHex,
}: SwatchGridProps) {
  const selected = normalizeHex(selectedHex);
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {colors.map((color) => {
        const active = selected === color;
        const swatch = (
          <button
            type="button"
            onClick={() => onSelect(color)}
            onMouseEnter={() => onHoverHex?.(color)}
            onMouseLeave={() => onHoverHex?.(null)}
            onFocus={() => onHoverHex?.(color)}
            onBlur={() => onHoverHex?.(null)}
            aria-label={color}
            aria-pressed={active}
            className={cn(
              "size-7 rounded-md border-2 transition-transform duration-100 outline-none hover:scale-110 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ink/50",
              active ? "border-ink ring-2 ring-ink/20" : "border-line/60",
              onRemove && "w-full",
            )}
            style={{ backgroundColor: color }}
          />
        );
        if (!onRemove) return <div key={color}>{swatch}</div>;
        return (
          <div key={color} className="group/fav relative">
            {swatch}
            <button
              type="button"
              onClick={() => onRemove(color)}
              aria-label={removeLabel ? `${removeLabel} ${color}` : color}
              className="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full border border-line bg-surface text-ink-3 shadow-sm transition-colors hover:text-dnf group-hover/fav:flex focus-visible:flex"
            >
              <X className="size-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
});
