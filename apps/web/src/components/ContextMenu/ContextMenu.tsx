"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { cn } from "@/lib/utils";
import { useContextMenuState } from "./contextMenuStore";
import { contextMenuStore } from "./contextMenuStore";
import type { ContextMenuItem } from "./contextMenuStore";

const VIEWPORT_PAD = 8;

/**
 * Portal-rendered context menu. Mounts at (x, y) with viewport clamping,
 * animates in, and closes on click outside / Escape / scroll.
 *
 * Items carry i18n keys in `label`; the component resolves them via
 * useTranslation("contextMenu") so callers just pass keys.
 */
export function ContextMenu() {
  const state = useContextMenuState();
  const { t } = useTranslation("contextMenu");
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  // Clamp to viewport once mounted (after measuring the menu's own size).
  useEffect(() => {
    if (!state.open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = state.x;
    let y = state.y;
    if (x + rect.width + VIEWPORT_PAD > vw) x = vw - rect.width - VIEWPORT_PAD;
    if (y + rect.height + VIEWPORT_PAD > vh) y = vh - rect.height - VIEWPORT_PAD;
    if (x < VIEWPORT_PAD) x = VIEWPORT_PAD;
    if (y < VIEWPORT_PAD) y = VIEWPORT_PAD;
    setPos({ x, y });
  }, [state.open, state.x, state.y]);

  // Close on Escape.
  useEffect(() => {
    if (!state.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") contextMenuStore.close();
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [state.open]);

  // Close on scroll (any scrollable ancestor or the window).
  useEffect(() => {
    if (!state.open) return;
    const handler = () => contextMenuStore.close();
    window.addEventListener("scroll", handler, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handler, { capture: true });
  }, [state.open]);

  // Close on click outside.
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        contextMenuStore.close();
      }
    },
    [],
  );

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;
      contextMenuStore.close();
      item.onClick?.();
    },
    [],
  );

  return createPortal(
    <AnimatePresence>
      {state.open && (
        <>
          {/* Invisible backdrop to catch clicks outside. pointer-events-auto
              is CRITICAL: Radix modal dialogs (Settings, Widget Explorer, …)
              set document.body { pointer-events: none } while open, and this
              portal would INHERIT it — clicks would pass through and the menu
              could never be closed by clicking outside.

              stopPropagation on pointerdown keeps this outside click from
              reaching Radix's document-level outside-interaction detection,
              which would otherwise close the dialog underneath. */}
          <motion.div
            className="pointer-events-auto fixed inset-0 z-[9998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={handleBackdropClick}
          />
          <motion.div
            ref={menuRef}
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y,
              zIndex: 9999,
            }}
            className={cn(
              // pointer-events-auto: Radix modal dialogs set
              // document.body { pointer-events: none } while open, which this
              // portal would inherit — the menu must stay interactive over
              // them (same fix as the backdrop).
              //
              // stopPropagation on pointerdown/click: interactions with the
              // menu are portaled to <body> (outside the dialog's content), so
              // without this Radix treats them as "outside" and closes the
              // dialog when the menu is used.
              "pointer-events-auto min-w-[200px] rounded-xl border border-line/80 bg-surface/95 p-1 shadow-xl backdrop-blur-xl",
              "select-none outline-none",
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {state.items.map((item) => (
              <div key={item.id}>
                {item.separatorBefore && (
                  <div className="my-1 h-px bg-line/60" />
                )}
                <button
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.82rem]",
                    "transition-colors duration-100",
                    item.disabled
                      ? "cursor-not-allowed text-ink-3/50"
                      : "cursor-pointer text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {item.icon && (
                    <item.icon className="size-4 shrink-0 text-ink-3" />
                  )}
                  <span className="truncate">
                    {t(item.label as ParseKeys<"contextMenu">)}
                  </span>
                </button>
              </div>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
