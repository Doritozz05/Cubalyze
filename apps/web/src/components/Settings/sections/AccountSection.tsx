"use client";

import { useTranslation } from "react-i18next";
import { AccountCard } from "@/components/Account/AccountCard";

/**
 * Settings → Account — Google sign-in, sync status, sign out and account
 * deletion. Reuses the AccountCard (same block as the Profile view) with the
 * destructive actions enabled.
 */
export function AccountSection() {
  const { t } = useTranslation("settings");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.78rem] leading-relaxed text-ink-3">
        {t("sections.account.description")}
      </p>
      <AccountCard allowDelete />
    </div>
  );
}
