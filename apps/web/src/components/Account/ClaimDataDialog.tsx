"use client";

/**
 * Claim dialog — shown the first time an account signs in on a device that
 * already holds local data. Two clear paths:
 *  - "Upload and combine" (default): push everything local to the account.
 *  - "Start fresh from the cloud": the account's data replaces this device.
 *
 * The user's choice is the plan-approved merge policy: never merge or wipe
 * silently — always ask once per (account, device) link.
 *
 * Styling follows the app's design tokens (bg-surface / text-ink / border-line
 * — see AuthView) rather than the generic shadcn variants, and the buttons
 * are h-auto + whitespace-normal so the two-line descriptions wrap.
 */

import { useTranslation } from "react-i18next";
import { ArrowUpFromLine, HardDriveDownload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAccount } from "@/hooks/useAccount";

function CountChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-[0.62rem] font-medium text-ink-2">
      {label}
    </span>
  );
}

export function ClaimDataDialog() {
  const { t } = useTranslation("auth");
  const account = useAccount();
  const { pendingCounts, claim, claimError } = account;

  const open = claim === "pending" || claim === "in_progress";
  const counts = pendingCounts;

  return (
    <Dialog open={open} onOpenChange={() => account.dismissClaim()}>
      <DialogContent className="max-w-md border-line bg-surface p-6 text-ink">
        <DialogHeader>
          <DialogTitle className="text-[0.95rem] font-semibold leading-6 text-ink">
            {t("claim.title")}
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            {t("claim.body")}
          </DialogDescription>
        </DialogHeader>

        {counts && (
          <div className="flex flex-wrap gap-1.5">
            {counts.solves > 0 && <CountChip label={t("claim.solves", { count: counts.solves })} />}
            {counts.sessions > 0 && <CountChip label={t("claim.sessions", { count: counts.sessions })} />}
            {counts.trainingAttempts > 0 && <CountChip label={t("claim.attempts", { count: counts.trainingAttempts })} />}
            {counts.trainingTasks > 0 && <CountChip label={t("claim.tasks", { count: counts.trainingTasks })} />}
            {counts.skills > 0 && <CountChip label={t("claim.skills", { count: counts.skills })} />}
            {counts.gearItems > 0 && <CountChip label={t("claim.items", { count: counts.gearItems })} />}
          </div>
        )}

        {claim === "in_progress" ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <Spinner size="sm" label={t("claim.inProgress")} />
            {claimError && (
              <p className="text-[0.68rem] text-dnf">{t("claim.error")}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => void account.resolveClaim("merge")}
              className="h-auto w-full justify-start gap-3 whitespace-normal rounded-lg border border-line bg-ink p-4 text-surface shadow-xs hover:bg-ink-2 has-[>svg]:px-4"
            >
              <ArrowUpFromLine className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span className="text-sm font-semibold leading-snug">{t("claim.merge")}</span>
                <span className="text-[0.68rem] font-normal leading-snug text-surface/70">
                  {t("claim.mergeDesc")}
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void account.resolveClaim("fresh")}
              className="h-auto w-full justify-start gap-3 whitespace-normal rounded-lg border border-line bg-surface p-4 text-ink shadow-xs hover:bg-surface-2 has-[>svg]:px-4"
            >
              <HardDriveDownload className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span className="text-sm font-semibold leading-snug">{t("claim.fresh")}</span>
                <span className="text-[0.68rem] font-normal leading-snug text-ink-3">
                  {t("claim.freshDesc")}
                </span>
              </span>
            </Button>
          </div>
        )}

        {claim !== "in_progress" && (
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={account.dismissClaim}
              className="text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              {t("claim.later")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
