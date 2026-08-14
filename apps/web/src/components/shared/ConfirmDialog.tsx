"use client";

import { useTranslation } from "react-i18next";
import { useIsTouch } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
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

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Optional supporting description */
  description?: string;
  /** Label for the confirm / action button. Defaults to common:delete */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to common:cancel */
  cancelLabel?: string;
  /** Visual intent of the confirm button. Default: "destructive" */
  variant?: "destructive" | "default";
  /** Called when the user clicks Confirm */
  onConfirm: () => void;
  /** Called when the user clicks Cancel (also fires on overlay click / Escape) */
  onCancel?: () => void;
}

/**
 * Reusable confirm / alert dialog.
 *
 * - **Desktop (≥768 px)**: `Dialog` with a blurred backdrop overlay.
 * - **Touch (<768 px)**: `Drawer` sliding up from the bottom.
 *
 * Pattern mirrors `CubeConnector` so both Dialog and Drawer surfaces look
 * identical in terms of styling tokens and responsive behaviour.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "destructive",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation("common");
  const isTouch = useIsTouch();

  const resolvedConfirmLabel = confirmLabel ?? t("delete");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  /* ─── Shared inner content ─────────────────────────────────────────── */
  const actions = (
    <div className="flex gap-2 flex-col sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onClick={handleCancel}
        className="sm:order-1 border-line bg-surface text-ink hover:bg-surface-2"
      >
        {resolvedCancelLabel}
      </Button>
      <Button
        variant={variant}
        onClick={handleConfirm}
        className="sm:order-2"
        autoFocus
      >
        {resolvedConfirmLabel}
      </Button>
    </div>
  );

  /* ─── Touch: Drawer ─────────────────────────────────────────────────── */
  if (isTouch) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-surface text-ink border-line rounded-t-2xl max-h-[85vh] p-0 pb-safe focus:outline-none">
          <DrawerHeader className="border-b border-line px-5 py-3.5 text-left">
            <DrawerTitle className="text-sm font-semibold text-ink">
              {title}
            </DrawerTitle>
            {description && (
              <DrawerDescription className="text-xs text-ink-3 mt-1">
                {description}
              </DrawerDescription>
            )}
          </DrawerHeader>
          <DrawerFooter className="px-5 pt-4 pb-6">
            {actions}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  /* ─── Desktop: Dialog ────────────────────────────────────────────────── */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-surface text-ink border-line backdrop:backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="mt-2">
          {actions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
