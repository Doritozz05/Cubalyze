"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Pipette, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  normalizeHex,
  rgbToHex,
  type HSV,
} from "./colorUtils";
import {
  MAX_FAVORITE_COLORS,
  removeFavoriteColor,
  saveFavoriteColor,
  useFavoriteColors,
} from "./useFavoriteColors";
import { SvArea } from "./SvArea";
import { HueSlider, RgbSliders } from "./ColorSliders";
import { HexField } from "./HexField";
import { SwatchGrid } from "./SwatchGrid";
import "./colorPicker.css";

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
  defaultColor?: string;
  onResetToDefault?: () => void;
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
 * Advanced color picker (Radix popover shell): SV area + hue + RGB + hex +
 * native OS picker + shared favorites.
 *
 * The popover is portalled with collision handling, so it never clips inside
 * the scrollable studio panel and flips when there is no room below.
 *
 * Performance contract: dragging/sliding only touches local draft state
 * (one small popover re-renders at most once per frame via rAF). The parent
 * store is written exactly once per gesture — on release, on Enter/blur, or
 * on swatch pick — so theme CSS, 3D materials and localStorage persist run
 * once instead of ~100 times per drag.
 */

let openPickerCount = 0;

/** True while any ColorPicker popover is open (dialogs use it for Escape). */
export function isColorPickerOpen(): boolean {
  return openPickerCount > 0;
}
export function ColorPicker({ value, onChange, label, defaultColor, onResetToDefault }: ColorPickerProps) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<HSV>(() => hexToHsv(value));
  const [hoverHex, setHoverHex] = useState<string | null>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const favorites = useFavoriteColors();

  const isOverridden = Boolean(
    defaultColor &&
      onResetToDefault &&
      value.trim().toLowerCase() !== defaultColor.trim().toLowerCase(),
  );

  const draftHex = useMemo(() => hsvToHex(draft.h, draft.s, draft.v), [draft]);
  const draftRgb = useMemo(() => hsvToRgb(draft.h, draft.s, draft.v), [draft]);
  const hueBase = useMemo(() => hsvToHex(draft.h, 100, 100), [draft.h]);
  const footerHex = hoverHex ?? draftHex;
  const currentIsFavorite = favorites.includes(draftHex);

  // Follow external changes while closed (parent is source of truth).
  useEffect(() => {
    if (!open) {
      const next = hexToHsv(value);
      draftRef.current = next;
      setDraft(next);
    }
  }, [value, open]);

  // Track open popovers globally so parent dialogs can keep their own
  // Escape handling while a picker is open (Radix closes the popover;
  // the dialog must not close underneath it).
  useEffect(() => {
    if (!open) return;
    openPickerCount += 1;
    return () => {
      openPickerCount = Math.max(0, openPickerCount - 1);
    };
  }, [open ]);

  /** The single store write per gesture — reads the latest draft via ref,
      so state updaters stay pure (StrictMode-safe). */
  const draftRef = useRef(draft);
  const applyPreview = useCallback((next: HSV) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const commitDraftNow = useCallback(() => {
    const next = draftRef.current;
    onChange(hsvToHex(next.h, next.s, next.v));
  }, [onChange]);

  const commitHex = useCallback(
    (hex: string, close = false) => {
      const normalized = normalizeHex(hex);
      if (!normalized) return;
      const next = hexToHsv(normalized);
      draftRef.current = next;
      setDraft(next);
      onChange(normalized);
      if (close) setOpen(false);
    },
    [onChange],
  );

  const previewSv = useCallback((s: number, v: number) => {
    const prev = draftRef.current;
    if (prev.s === s && prev.v === v) return;
    applyPreview({ ...prev, s, v });
  }, [applyPreview]);

  const previewHue = useCallback((h: number) => {
    const prev = draftRef.current;
    if (prev.h === h) return;
    applyPreview({ ...prev, h });
  }, [applyPreview]);

  const previewChannel = useCallback((channel: "r" | "g" | "b", val: number) => {
    const prev = draftRef.current;
    const rgb = hsvToRgb(prev.h, prev.s, prev.v);
    const nextRgb = {
      r: channel === "r" ? val : rgb.r,
      g: channel === "g" ? val : rgb.g,
      b: channel === "b" ? val : rgb.b,
    };
    const hex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    const next = hexToHsv(hex);
    if (prev.h === next.h && prev.s === next.s && prev.v === next.v) return;
    applyPreview(next);
  }, [applyPreview]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        const synced = hexToHsv(value);
        draftRef.current = synced;
        setDraft(synced);
        setHoverHex(null);
      }
      setOpen(next);
    },
    [value],
  );

  const selectAndClose = useCallback(
    (hex: string) => commitHex(hex, true),
    [commitHex],
  );

  const pickNativeLabel = t("appearance.colorPicker.pickNative", "Selector del sistema");
  const saveLabel = t("appearance.colorPicker.saveFavorite", "Guardar en favoritos");
  const removeLabel = t("appearance.colorPicker.removeFavorite", "Quitar de favoritos");
  const resetTokenLabel = t("appearance.colors.resetColor", "Restablecer al color original del tema");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="group relative flex max-lg:min-h-11 max-lg:w-full items-center">
        <DialogTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={label}
            className={cn(
              "flex w-full min-w-0 items-center gap-2.5 rounded-lg border border-line bg-surface-2/50 py-2 pl-3 text-left transition-all duration-150 hover:border-ink/20 hover:bg-surface-2",
              isOverridden ? "pr-9" : "pr-3"
            )}
          >
            <div
              className="size-7 shrink-0 rounded-md border-2 border-line shadow-sm transition-transform duration-150 group-hover:scale-105"
              style={{ backgroundColor: value }}
            />
            <div className="text-left min-w-0 flex-1">
              <span className="block text-[0.75rem] font-medium text-ink leading-tight truncate">
                {label}
              </span>
              <span className="block text-[0.62rem] text-ink-3 font-mono">
                {value}
              </span>
            </div>
          </button>
        </DialogTrigger>
        {isOverridden && onResetToDefault && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetToDefault();
                }}
                aria-label={resetTokenLabel}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface/90 text-ink-3 shadow-2xs backdrop-blur-xs transition-all hover:bg-surface hover:text-ink hover:scale-105 active:scale-95 cursor-pointer z-10"
              >
                <RotateCcw className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{resetTokenLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <DialogContent
        aria-label={label}
        className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xs overflow-y-auto overscroll-contain p-4 sm:max-w-xl sm:p-5"
      >
        <DialogTitle className="flex items-center gap-2 text-xs font-semibold text-ink">
          <span
            aria-hidden="true"
            className="size-5 shrink-0 rounded-md border border-line"
            style={{ backgroundColor: footerHex }}
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="shrink-0 font-mono font-normal text-ink-3">{footerHex}</span>
        </DialogTitle>

        {/* 2-column grid for tablets and PC (sm:grid-cols-2) */}
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {/* Column 1: Visual picker (SV plane + Hue + Hex row) */}
          <div className="flex flex-col gap-2.5">
            <SvArea
              hue={draft.h}
              saturation={draft.s}
              value={draft.v}
              hueBase={hueBase}
              draftHex={draftHex}
              onPreview={previewSv}
              onCommit={commitDraftNow}
            />

            <div className="flex items-center">
              <HueSlider hue={draft.h} onPreview={previewHue} onCommit={commitDraftNow} />
            </div>

            {/* Hex + native + save */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <div
                aria-hidden="true"
                onClick={() => nativeInputRef.current?.click()}
                className="size-7 shrink-0 cursor-pointer rounded-md border border-line shadow-xs transition-transform hover:scale-105"
                style={{ backgroundColor: draftHex }}
              />
              <input
                ref={nativeInputRef}
                type="color"
                value={draftHex}
                onChange={(e) => commitHex(e.target.value)}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              <HexField draftHex={draftHex} onCommit={commitHex} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => nativeInputRef.current?.click()}
                    aria-label={pickNativeLabel}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2/50 text-ink-3 transition-colors outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/50"
                  >
                    <Pipette className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{pickNativeLabel}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentIsFavorite) removeFavoriteColor(draftHex);
                      else saveFavoriteColor(draftHex);
                    }}
                    aria-label={currentIsFavorite ? removeLabel : saveLabel}
                    aria-pressed={currentIsFavorite}
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink/50",
                      currentIsFavorite
                        ? "border-ink bg-ink text-surface"
                        : "border-line bg-surface-2/50 text-ink-3 hover:text-ink",
                    )}
                  >
                    {currentIsFavorite ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {currentIsFavorite ? removeLabel : saveLabel}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Column 2: RGB Sliders + Palettes (Favorites + Presets) */}
          <div className="flex flex-col gap-2.5">
            <RgbSliders rgb={draftRgb} onPreviewChannel={previewChannel} onCommit={commitDraftNow} />

            {/* Favorites */}
            <div className="border-t border-line pt-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-3">
                  {t("appearance.colorPicker.favorites", "Favoritos")}
                </span>
                <span className="font-mono text-[0.6rem] text-ink-3">
                  {favorites.length}/{MAX_FAVORITE_COLORS}
                </span>
              </div>
              {favorites.length === 0 ? (
                <p className="rounded-md bg-surface-2/50 px-2 py-1 text-[0.65rem] leading-snug text-ink-3">
                  {t(
                    "appearance.colorPicker.favoritesEmpty",
                    "Guarda colores con + para reutilizarlos en stickers y temas.",
                  )}
                </p>
              ) : (
                <SwatchGrid
                  colors={favorites}
                  selectedHex={value}
                  onSelect={selectAndClose}
                  onRemove={removeFavoriteColor}
                  removeLabel={removeLabel}
                  onHoverHex={setHoverHex}
                />
              )}
            </div>

            {/* Presets */}
            <div className="border-t border-line pt-2">
              <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-3">
                {t("appearance.colorPicker.presets", "Predefinidos")}
              </div>
              <SwatchGrid
                colors={PRESET_COLORS}
                selectedHex={value}
                onSelect={selectAndClose}
                onHoverHex={setHoverHex}
              />
            </div>
          </div>
        </div>

        {/* Footer: current vs new/hovered + Done button */}
        <div className="mt-3.5 flex items-center justify-between border-t border-line pt-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div
              role="img"
              aria-label={t("appearance.colorPicker.current", "Actual")}
              className="size-6 shrink-0 rounded-md border border-line shadow-2xs"
              style={{ backgroundColor: value }}
            />
            <span aria-hidden="true" className="font-mono text-[0.65rem] text-ink-3">→</span>
            <div
              role="img"
              aria-label={t("appearance.colorPicker.new", "Nuevo")}
              className="size-6 shrink-0 rounded-md border border-line shadow-2xs"
              style={{ backgroundColor: footerHex }}
            />
            <span className="truncate font-mono text-[0.65rem] text-ink">{footerHex}</span>
          </div>
          <div className="flex items-center gap-2">
            {isOverridden && onResetToDefault && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onResetToDefault();
                  setOpen(false);
                }}
                className="h-7 shrink-0 gap-1.5 px-2 text-xs text-ink-3 hover:text-ink hover:bg-surface-2 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>{t("common.reset", "Restablecer")}</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-7 shrink-0 border-line bg-surface-2 px-3 text-xs font-medium text-ink transition-colors hover:bg-surface hover:text-ink cursor-pointer"
            >
              {t("appearance.colorPicker.done", "Listo")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
