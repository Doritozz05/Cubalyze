"use client";

/**
 * Account card — the reusable identity/sync block shown in the Profile view
 * and in Settings → Account.
 *
 * Signed out: a clear CTA that routes to /auth.
 * Signed in: the account email, live sync status, "Sync now", sign out and
 * (in Settings) delete account. The claim dialog opens when the user logged
 * in on a device that already had local data (claim === "pending").
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CloudOff, CloudUpload, RefreshCw, LogOut, Trash2 } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { useStore } from "zustand";
import { syncStore } from "@cubeforge/state";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { GoogleIcon } from "@/components/Account/GoogleIcon";
import { ClaimDataDialog } from "@/components/Account/ClaimDataDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface AccountCardProps {
  /** Show the destructive "delete account" action (Settings only). */
  allowDelete?: boolean;
  compact?: boolean;
}

export function AccountCard({ allowDelete = false }: AccountCardProps) {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const account = useAccount();
  const syncStatus = useStore(syncStore, (s) => s.status);
  const lastSyncedAt = useStore(syncStore, (s) => s.lastSyncedAt);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const syncLabel = () => {
    switch (syncStatus) {
      case "syncing":
      case "claim":
        return t("account.syncing");
      case "claim_pending":
        return t("account.claimPending");
      case "error":
        return t("account.errorStatus");
      case "idle":
        return t("account.idle");
      default:
        return t("account.signedOut");
    }
  };

  // A signed-in account that never resolved the first-login claim: the
  // engine is gated (nothing uploads, nothing downloads) until the user
  // picks "combine" or "fresh" — surfaced clearly instead of a green idle.
  const claimPending = !!account.user && !account.linked;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await account.signOut();
    } catch (err) {
      console.error("[AccountCard] sign out failed:", err);
      toast.error(t("errorGeneric"));
    } finally {
      setSigningOut(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await account.deleteAccount();
      toast.success(t("account.signOut"));
    } catch (err) {
      console.error("[AccountCard] delete failed:", err);
      toast.error(t("account.deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
      <ClaimDataDialog />

      <div className="flex items-center gap-3">
        {account.user ? (
          <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2">
            <CloudUpload className="size-4" />
          </div>
        ) : (
          <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-3">
            <CloudOff className="size-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
            {t("account.cardTitle")}
          </p>
          {account.user ? (
            <p className="truncate text-sm font-semibold text-ink">
              {account.user.email ?? account.user.id}
            </p>
          ) : (
            <p className="text-sm font-semibold text-ink">{t("account.signedOut")}</p>
          )}
        </div>
        {account.user && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-[0.6rem] font-medium text-ink-2">
            <span
              className={`size-1.5 rounded-full ${
                syncStatus === "error"
                  ? "bg-dnf"
                  : syncStatus === "syncing" ||
                      syncStatus === "claim" ||
                      syncStatus === "claim_pending"
                    ? "bg-caution animate-pulse"
                    : "bg-ready"
              }`}
              aria-hidden="true"
            />
            {syncLabel()}
          </span>
        )}
      </div>

      {claimPending && (
        <div className="flex flex-col gap-2 rounded-lg border border-caution/30 bg-caution/10 p-3">
          <p className="text-[0.7rem] font-semibold text-caution">
            {t("account.pendingTitle")}
          </p>
          <p className="text-[0.65rem] leading-relaxed text-ink-3">
            {t("account.pendingBody")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void account.reopenClaim()}
            className="self-start"
          >
            {t("account.linkNow")}
          </Button>
        </div>
      )}

      {account.user ? (
        <>
          <p className="text-[0.65rem] leading-relaxed text-ink-3">
            {t("account.lastSync", {
              time:
                lastSyncedAt && lastSyncedAt > 0
                  ? new Date(lastSyncedAt).toLocaleString()
                  : t("account.never"),
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void import("@/services/sync").then((m) => m.syncNow());
              }}
              disabled={
                syncStatus === "syncing" ||
                syncStatus === "claim" ||
                claimPending
              }
            >
              {syncStatus === "syncing" || syncStatus === "claim" ? (
                <Spinner size="xs" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {t("account.syncNow")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              {signingOut ? <Spinner size="xs" /> : <LogOut className="size-3.5" />}
              {t("account.signOut")}
            </Button>
            {allowDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-dnf hover:text-dnf"
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Spinner size="xs" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {t("account.deleteAccount")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("account.deleteConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("account.deleteConfirmBody")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("claim.later")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        void handleDelete();
                      }}
                      className="bg-dnf text-surface hover:bg-dnf/90"
                    >
                      {t("account.deleteConfirmAction")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-[0.65rem] leading-relaxed text-ink-3">
            {t("account.syncCta")}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => navigate("/auth")}
            className="self-start"
          >
            <GoogleIcon size={14} />
            {t("account.signIn")}
          </Button>
        </>
      )}
    </div>
  );
}
