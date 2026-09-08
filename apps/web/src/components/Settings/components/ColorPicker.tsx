"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Pipette, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
 * Advanced color picker (zero deps): SV area + hue + RGB + hex + native OS
 * picker + shared favorites.
 *
 * Performance contract: dragging/sliding only touches local draft state
 * (one small popover re-renders at most once per frame via rAF). The parent
 * store is written exactly once per gesture — on release, on Enter/blur, or
 * on swatch pick — so theme CSS, 3D materials and localStorage persist run
 * once instead of ~100 times per drag.
 */
export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<HSV>(() => hexToHsv(value));
  const [hoverHex, setHoverHex] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const favorites = useFavoriteColors();

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

  // Close on click outside / Escape.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

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

  const handleToggle = useCallback(() => {
    if (!open) {
      const next = hexToHsv(value);
      draftRef.current = next;
      setDraft(next);
      setHoverHex(null);
    }
    setOpen((o) => !o);
  }, [open, value]);

  const selectAndClose = useCallback(
    (hex: string) => commitHex(hex, true),
    [commitHex],
  );

  const pickNativeLabel = t("appearance.colorPicker.pickNative", "Selector del sistema");
  const saveLabel = t("appearance.colorPicker.saveFavorite", "Guardar en favoritos");
  const removeLabel = t("appearance.colorPicker.removeFavorite", "Quitar de favoritos");

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
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
        <div
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-line bg-surface p-3 shadow-xl"
        >
          <SvArea
            hue={draft.h}
            saturation={draft.s}
            value={draft.v}
            hueBase={hueBase}
            draftHex={draftHex}
            onPreview={previewSv}
            onCommit={commitDraftNow}
          />

          <div className="mt-1 flex items-center">
            <HueSlider hue={draft.h} onPreview={previewHue} onCommit={commitDraftNow} />
          </div>

          <div className="mt-1.5">
            <RgbSliders rgb={draftRgb} onPreviewChannel={previewChannel} onCommit={commitDraftNow} />
          </div>

          {/* Hex + native + save */}
          <div className="mt-2 flex items-center gap-1.5">
            <div
              aria-hidden="true"
              onClick={() => nativeInputRef.current?.click()}
              className="size-7 shrink-0 cursor-pointer rounded-md border border-line"
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

          {/* Favorites */}
          <div className="mt-2.5 border-t border-line pt-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-3">
                {t("appearance.colorPicker.favorites", "Favoritos")}
              </span>
              <span className="font-mono text-[0.6rem] text-ink-3">
                {favorites.length}/{MAX_FAVORITE_COLORS}
              </span>
            </div>
            {favorites.length === 0 ? (
              <p className="rounded-md bg-surface-2/50 px-2 py-1.5 text-[0.65rem] leading-snug text-ink-3">
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
          <div className="mt-2.5 border-t border-line pt-2.5">
            <div className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-3">
              {t("appearance.colorPicker.presets", "Predefinidos")}
            </div>
            <SwatchGrid
              colors={PRESET_COLORS}
              selectedHex={value}
              onSelect={selectAndClose}
              onHoverHex={setHoverHex}
            />
          </div>

          {/* Footer: current vs new/hovered */}
          <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div
                role="img"
                aria-label={t("appearance.colorPicker.current", "Actual")}
                className="size-6 shrink-0 rounded-md border border-line"
                style={{ backgroundColor: value }}
              />
              <span aria-hidden="true" className="font-mono text-[0.65rem] text-ink-3">→</span>
              <div
                role="img"
                aria-label={t("appearance.colorPicker.new", "Nuevo")}
                className="size-6 shrink-0 rounded-md border border-line"
                style={{ backgroundColor: footerHex }}
              />
              <span className="truncate font-mono text-[0.65rem] text-ink">{footerHex}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-md bg-ink px-3 py-1.5 text-[0.65rem] font-medium text-surface outline-none transition-colors hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-ink/50"
            >
              {t("appearance.colorPicker.done", "Listo")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
