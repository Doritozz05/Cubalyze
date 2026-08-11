"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

const PRESET_COLORS = [
  "#ece8e2", "#ffffff", "#d4d4d4", "#a3a3a3", "#525252",
  "#ffe62a", "#facc15", "#eab308", "#f59e0b",
  "#1abe57", "#22c55e", "#16a34a", "#15803d",
  "#3d7ce0", "#3b82f6", "#2563eb", "#1d4ed8",
  "#eb4242", "#ef4444", "#dc2626", "#b91c1c",
  "#ff801f", "#f97316", "#ea580c", "#c2410c",
  "#a855f7", "#8b5cf6", "#ec4899", "#06b6d4",
];

/**
 * Compact, minimal color picker with a swatch trigger and a popover grid.
 * Designed for the Custom cube skin settings panel.
 */
export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleHexSubmit = useCallback(() => {
    const hex = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex);
      setOpen(false);
    }
  }, [hexInput, onChange]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex max-lg:min-h-11 max-lg:w-full items-center gap-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 transition-all duration-150 hover:border-ink/20 hover:bg-surface-2"
      >
        <div
          className="size-7 shrink-0 rounded-md border-2 border-line shadow-sm transition-transform duration-150 group-hover:scale-105"
          style={{ backgroundColor: value }}
        />
        <div className="text-left min-w-0">
          <span className="block text-[0.75rem] font-medium text-ink leading-tight">
            {label}
          </span>
          <span className="block text-[0.62rem] text-ink-3 font-mono">
            {value}
          </span>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-3 shadow-xl">
          {/* Header with hex input */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="size-6 shrink-0 rounded-md border border-line"
              style={{ backgroundColor: value }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleHexSubmit();
                if (e.key === "Escape") setOpen(false);
              }}
              className="flex-1 rounded-md border border-line bg-surface-2/50 px-2 py-1 text-[0.72rem] font-mono text-ink placeholder:text-ink-3/40 focus:outline-none focus:border-ink/30"
              placeholder="#1abe57"
              autoFocus
            />
            <button
              onClick={handleHexSubmit}
              className="rounded-md bg-ink px-2.5 py-1 text-[0.65rem] font-medium text-surface hover:bg-ink/90 transition-colors"
            >
              {i18n.t("common:ok")}
            </button>
          </div>

          {/* Preset grid */}
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <Tooltip key={color}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(color);
                      setOpen(false);
                    }}
                    className={cn(
                      "size-7 rounded-md border-2 transition-all duration-100 hover:scale-110 hover:shadow-md",
                      value === color ? "border-ink ring-2 ring-ink/20" : "border-line/60",
                    )}
                    style={{ backgroundColor: color }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">{color}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
