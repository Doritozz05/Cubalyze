"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { History, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SessionMeta } from "@/hooks/usePersistentSession";

export interface MobileSessionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions?: SessionMeta[];
  activeSessionId?: string | null;
  onSwitchSession?: (id: string) => void;
  onNewSession?: () => void;
  onRenameSession?: (id: string, name: string) => void;
  onDeleteSession?: (id: string) => void;
}

export function MobileSessionSheet({
  open,
  onOpenChange,
  sessions = [],
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
}: MobileSessionSheetProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionMeta | null>(null);
  const { t } = useTranslation("shell");
  const { t: tCommon } = useTranslation();

  const startRename = (s: SessionMeta) => {
    setRenamingId(s.id);
    setRenameValue(s.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameSession?.(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-surface text-ink border-line rounded-t-2xl max-h-[85vh] p-0 pb-safe focus:outline-none">
          <DrawerHeader className="border-b border-line px-5 py-3.5 text-left">
            <DrawerTitle className="text-sm font-semibold text-ink flex items-center gap-2">
              <History className="size-4 text-ink-3" />
              <span>{t("sessions")}</span>
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col p-4 gap-2 overflow-y-auto max-h-[65vh]">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border border-line/70 bg-surface-2/40 p-3 transition-all",
                  s.id === activeSessionId && "border-ink/30 bg-surface-2 font-semibold shadow-2xs"
                )}
              >
                {renamingId === s.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="nums h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-ink-2"
                    />
                    <button
                      type="button"
                      onClick={commitRename}
                      className="grid size-9 place-items-center rounded-lg bg-surface border border-line text-ink-2 hover:text-ink cursor-pointer"
                      aria-label={t("confirmRename")}
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="grid size-9 place-items-center rounded-lg bg-surface border border-line text-ink-3 hover:text-ink cursor-pointer"
                      aria-label={t("cancelRename")}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchSession?.(s.id);
                        onOpenChange(false);
                      }}
                      className="flex flex-1 items-center gap-3 text-left py-0.5 cursor-pointer"
                    >
                      <span className="text-sm font-medium text-ink truncate">{s.name}</span>
                      <span className="text-xs text-ink-3 font-mono bg-surface px-2 py-0.5 rounded-full border border-line/50 shrink-0">
                        {t("solveCount", { count: s.solveCount })}
                      </span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(s);
                        }}
                        className="grid size-8 place-items-center rounded-lg hover:bg-surface text-ink-3 hover:text-ink transition-colors cursor-pointer"
                        aria-label={t("renameSession", { name: s.name })}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(s);
                        }}
                        className="grid size-8 place-items-center rounded-lg hover:bg-surface text-ink-3 hover:text-dnf transition-colors cursor-pointer"
                        aria-label={t("deleteSession", { name: s.name })}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                onNewSession?.();
                onOpenChange(false);
              }}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-line bg-surface p-3 text-xs font-semibold text-ink hover:bg-surface-2 transition-all cursor-pointer"
            >
              <Plus className="size-4" />
              <span>{t("newSession")}</span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete session confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(op) => !op && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteSessionMobileTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteSessionMobileDescription", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) onDeleteSession?.(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-dnf text-surface hover:bg-dnf/90"
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
