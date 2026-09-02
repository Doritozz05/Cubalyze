"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { History, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUCH_FULL_BLEED } from "@/lib/touch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export interface SessionPieceProps {
  sessions: SessionMeta[];
  activeSessionId?: string | null;
  sessionCount?: number;
  onSwitchSession?: (id: string) => void;
  onNewSession?: () => void;
  onRenameSession?: (id: string, name: string) => void;
  onDeleteSession?: (id: string) => void;
}

/** Desktop session switcher — a tray item that opens the flyout (rename/delete). */
export function SessionPiece({
  sessions,
  activeSessionId,
  sessionCount,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
}: SessionPieceProps) {
  const { t } = useTranslation("shell");
  const { t: tCommon } = useTranslation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionMeta | null>(null);
  const active = sessions.find((s) => s.id === activeSessionId) ?? null;

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-full px-2.5 py-0 text-xs font-medium leading-none text-ink-2 hover:bg-surface-2 hover:text-ink"
            aria-label={t("switchSession")}
          >
            <History className="size-3.5 shrink-0 text-ink-3" />
            <span className="nums max-w-28 truncate leading-none">
              {active?.name ?? t("session")}
            </span>
            <span className="text-ink-3 leading-none">·</span>
            <span className="nums text-ink-3 leading-none">{sessionCount ?? 0}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-60"
          data-context-zone="session"
        >
          <DropdownMenuLabel className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
            {t("sessions")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sessions.map((s) => (
            <div key={s.id} className="group/sess flex items-center">
              {renamingId === s.id ? (
                <div className="flex flex-1 items-center gap-1 px-2 py-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="nums h-7 min-w-0 flex-1 rounded-sm border border-line bg-surface px-1.5 text-xs text-ink outline-none focus:border-ink-2"
                  />
                  <button
                    onClick={commitRename}
                    className="grid size-6 place-items-center rounded text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                    aria-label={t("confirmRename")}
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    className="grid size-6 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                    aria-label={t("cancelRename")}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onSwitchSession?.(s.id)}
                    className={cn(
                      "flex flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-2",
                      s.id === activeSessionId && "bg-surface-2",
                    )}
                  >
                    <span className="nums min-w-0 flex-1 truncate text-ink">
                      {s.name}
                    </span>
                    <span className="nums shrink-0 text-[0.65rem] text-ink-3">
                      {s.solveCount}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 pr-1 text-ink-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(s);
                      }}
                      className="grid size-6 place-items-center rounded hover:bg-surface-2 hover:text-ink transition-colors"
                      aria-label={t("renameSession", { name: s.name })}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      className="grid size-6 place-items-center rounded hover:bg-surface-2 hover:text-dnf transition-colors"
                      aria-label={t("deleteSession", { name: s.name })}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onNewSession?.()}>
            <Plus className="size-3.5" />
            {t("newSession")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete-session confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className={`max-w-sm ${TOUCH_FULL_BLEED} max-lg:max-h-[85vh] max-lg:overflow-y-auto`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {t("deleteSessionTitle", { name: deleteTarget?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {t("deleteSessionDescription", { count: deleteTarget?.solveCount ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="max-lg:h-11 h-8 text-xs">{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="max-lg:h-11 h-8 bg-dnf text-xs text-white hover:bg-dnf/90"
              onClick={() => {
                if (deleteTarget) onDeleteSession?.(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
