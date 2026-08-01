"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/utils/haptics";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

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
 * Uses Vaul Drawer for smooth mobile swipe-to-dismiss drag gestures.
 * Fixed to the bottom of the viewport with a rounded top, drag-handle,
 * backdrop and iOS safe-area padding. Desktop (>=1024px) never renders it.
 */
export function TouchPanel({ open, onOpenChange, title, children, className }: TouchPanelProps) {
  // Light tap when the sheet opens (touch regime only).
  useEffect(() => {
    if (open) hapticTap();
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "bg-surface text-ink border-line rounded-t-2xl max-h-[80vh] p-0 pb-safe focus:outline-none lg:hidden",
          className,
        )}
      >
        <DrawerHeader className="border-b border-line px-5 py-3 text-left">
          <DrawerTitle className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
            {title ?? "Panel"}
          </DrawerTitle>
        </DrawerHeader>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
