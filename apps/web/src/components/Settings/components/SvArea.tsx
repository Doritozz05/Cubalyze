"use client";

import { memo, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface SvAreaProps {
  hue: number;
  saturation: number;
  value: number;
  /** Base hue color (h,100,100) for the area background. */
  hueBase: string;
  /** Draft hex for the thumb fill + screen-reader announcement. */
  draftHex: string;
  /** Local-only preview while dragging (no store writes). */
  onPreview: (saturation: number, value: number) => void;
  /** Single store commit when the gesture / keypress ends. */
  onCommit: () => void;
}

const KEY_STEP = 2;
const KEY_STEP_LARGE = 10;

/**
 * 2D saturation/value area. Pointer moves are coalesced to one update per
 * animation frame and only touch local draft state — the parent commits to
 * the store once on pointer-up.
 */
export const SvArea = memo(function SvArea({
  hue,
  saturation,
  value,
  hueBase,
  draftHex,
  onPreview,
  onCommit,
}: SvAreaProps) {
  const { t } = useTranslation("settings");
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const rectCache = useRef<DOMRect | null>(null);
  const raf = useRef(0);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const callbacks = useRef({ onPreview, onCommit });
  callbacks.current = { onPreview, onCommit };

  const flush = useCallback(() => {
    raf.current = 0;
    const rect = rectCache.current;
    const point = pending.current;
    pending.current = null;
    if (!rect) return;
    if (!point) return;
    const s = Math.max(0, Math.min(100, ((point.x - rect.left) / rect.width) * 100));
    const v = Math.max(0, Math.min(100, 100 - ((point.y - rect.top) / rect.height) * 100));
    callbacks.current.onPreview(Math.round(s), Math.round(v));
  }, []);

  const schedule = useCallback(
    (clientX: number, clientY: number) => {
      pending.current = { x: clientX, y: clientY };
      if (raf.current === 0) raf.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (raf.current !== 0) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    rectCache.current = null;
    if (raf.current !== 0) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      pending.current = null;
    }
    callbacks.current.onCommit();
  }, []);

  return (
    <div
      ref={areaRef}
      role="slider"
      tabIndex={0}
      aria-label={t("appearance.colorPicker.saturationValue", "Saturación y brillo")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(saturation)}
      aria-valuetext={`${draftHex}, ${t("appearance.colorPicker.hue", "Tono")} ${Math.round(hue)}`}
      onPointerDown={(e) => {
        dragging.current = true;
        rectCache.current = e.currentTarget.getBoundingClientRect();
        e.currentTarget.setPointerCapture(e.pointerId);
        schedule(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (dragging.current) schedule(e.clientX, e.clientY);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(e) => {
        const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
        let s = saturation;
        let v = value;
        if (e.key === "ArrowLeft") s -= step;
        else if (e.key === "ArrowRight") s += step;
        else if (e.key === "ArrowUp") v += step;
        else if (e.key === "ArrowDown") v -= step;
        else return;
        e.preventDefault();
        onPreview(
          Math.max(0, Math.min(100, Math.round(s))),
          Math.max(0, Math.min(100, Math.round(v))),
        );
        onCommit();
      }}
      className="relative h-32 w-full cursor-crosshair touch-none overflow-hidden rounded-lg border border-line outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
      style={{ backgroundColor: hueBase }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black to-transparent" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
        style={{
          left: `${saturation}%`,
          top: `${100 - value}%`,
          backgroundColor: draftHex,
          boxShadow: "0 1px 4px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.25)",
        }}
      />
    </div>
  );
});
