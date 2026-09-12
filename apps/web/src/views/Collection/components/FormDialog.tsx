"use client";

/**
 * FormDialog.tsx — the shared shell for every Locker form.
 *
 * A single scrollable body with a fixed header/footer, so long forms (the item
 * editor) never push their actions off-screen. Panels use the theme's surface
 * token, so liquid glass and custom themes apply automatically.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isColorPickerOpen } from "@/components/Settings/components/ColorPicker";
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
