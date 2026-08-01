"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/utils/haptics";

export interface TouchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional title shown in the sheet header. */
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Generic bottom sheet for the touch regime (<1024px).
 *
 * Fixed to the bottom of the viewport with a rounded top, drag-handle,
 * backdrop and iOS safe-area padding. Desktop (>=1024px) never renders it —
 * callers gate it with `useIsTouch()` / `TouchAside`, and it is also
 * `lg:hidden` as a safety net.
 */
export function TouchPanel({ open, onOpenChange, title, children, className }: TouchPanelProps) {
  // Light tap when the sheet opens (touch regime only).
  useEffect(() => {
    if (open) hapticTap();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
            onClick={() => onOpenChange(false)}
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col rounded-t-2xl border-t border-line bg-surface pb-safe shadow-2xl lg:hidden",
              className,
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Panel"}
          >
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pt-2.5 pb-1">
              <div className="h-1 w-10 rounded-full bg-line" />
            </div>

            {title && (
              <div className="flex shrink-0 items-center justify-between px-5 pb-2">
                <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close panel"
                  className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
