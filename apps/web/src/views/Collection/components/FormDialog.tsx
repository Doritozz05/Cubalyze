"use client";

/**
 * FormDialog.tsx — the shared shell for every Locker form.
 *
 * One scrollable body with a fixed header/footer, so long forms (the item
 * editor) never push their actions off-screen.
 *
 * Two surfaces, one body:
 *
 *   • **Pointer (≥768px)**: a centred `Dialog`, `p-0` so the header and footer
 *     can own their own hairline borders.
 *   • **Touch (<768px)**: an 85vh bottom sheet (`Drawer`), the same shape
 *     Settings and the Widget Explorer use. A long form deserves the full
 *     width of the phone, and the sheet keeps the primary buttons inside the
 *     thumb arc with the home-indicator inset respected.
 *
 * Panels use the theme's surface token, so liquid glass and custom themes
 * apply automatically on both.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { isColorPickerOpen } from "@/components/Settings/components/ColorPicker";
import { useIsTouch } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}) {
  const isTouch = useIsTouch();

  if (isTouch) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-surface text-ink border-line h-[85vh] max-h-[85vh] rounded-t-2xl p-0 focus:outline-none">
          <DrawerHeader className="shrink-0 border-b border-line px-5 py-4 text-left">
            <DrawerTitle className="text-base">{title}</DrawerTitle>
            {description ? (
              <DrawerDescription className="text-[0.75rem] text-ink-3">
                {description}
              </DrawerDescription>
            ) : null}
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>
          <DrawerFooter className="shrink-0 flex-row justify-end gap-2 border-t border-line px-5 py-4 pb-safe">
            {footer}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // The reused ColorPicker is a nested dialog: Escape must close the
        // picker first, never the form underneath it.
        onEscapeKeyDown={(event) => {
          if (isColorPickerOpen()) event.preventDefault();
        }}
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 overflow-hidden border-line bg-surface p-0 text-ink sm:max-w-lg",
          className,
        )}
      >
        <DialogHeader className="shrink-0 border-b border-line px-5 py-4">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>
        <DialogFooter className="shrink-0 border-t border-line px-5 py-4">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
