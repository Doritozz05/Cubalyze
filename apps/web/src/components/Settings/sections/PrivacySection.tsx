"use client";

/**
 * PrivacySection — who sees what, plus the handle that makes you findable.
 *
 * The consent lives on the SERVER (`profile_visibility`, written only through
 * `privacy_set`), not in the profile row. That is not normalisation dogma: the
 * profile row travels through `sync_apply`, whose `on conflict do update`
 * enumerates columns, so an older client would silently reset a consent flag
 * to its default on every push. Consent must not be a synced field.
 *
 * Defaults are the product decision (D4): identity ON, stats and locker OFF,
 * requests ON. The copy says what each switch literally exposes, because in
 * this screen the honest wording IS the feature — including that the heatmap
 * reveals when you practise, which is the most revealing thing that crosses
 * the wire.
 *
 * Every switch saves the whole set immediately. Partial updates would need a
 * second endpoint and would leave the four flags able to disagree with each
 * other; a full write is idempotent and cheap.
 */

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { EmptyState } from "@/components/Insights/atoms/EmptyState";
import { SettingToggle } from "../components/SettingToggle";
import { HandleClaimCard } from "@/views/Friends/components/HandleClaimCard";
import { FRIEND_FAILURE_KEY } from "@/views/Friends/friendsCopy";
import { usePrivacy } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import type { FriendVisibility } from "@/services/friends";

export function PrivacySection() {
  const { t } = useTranslation("friends");
  const { profile } = useProfile();
  const { settings, loading, error, saving, save, reload } = usePrivacy();
  // Local copy so a toggle flips instantly; the server echo replaces it.
  const [draft, setDraft] = useState<FriendVisibility | null>(null);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  if (error && !settings) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <EmptyState
          icon={<Lock className="size-5" />}
          title={t("privacy.unavailable")}
          description={t(FRIEND_FAILURE_KEY[error])}
          action={
            <button
              type="button"
              onClick={() => void reload()}
              className="cursor-pointer rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-surface transition-colors hover:bg-ink/90"
            >
              {t("privacy.retry")}
            </button>
          }
        />
      </div>
    );
  }

  if (loading && !draft) {
    return (
      <div className="flex justify-center rounded-xl border border-line bg-surface p-8">
        <Loader2 className="size-4 animate-spin text-ink-3" aria-hidden="true" />
      </div>
    );
  }

  const current = draft;

  /**
   * Optimistic, but never final: if the write is refused the switch is put
   * BACK and the failure is shown. Leaving a consent switch flipped while the
   * server still has the old value is the one kind of UI lie that matters
   * here — it says "shared" for something that is not.
   */
  const update = (patch: Partial<FriendVisibility>) => {
    if (!current) return;
    const previous = current;
    const next = { ...current, ...patch };
    setDraft(next);
    void save(next).then((res) => {
      if (res.ok) return;
      setDraft(previous);
      toast.error(t(FRIEND_FAILURE_KEY[res.reason]));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <HandleClaimCard current={profile?.handle ?? ""} />

      {current && (
        <>
          <SettingToggle
            title={t("privacy.shareProfile")}
            description={t("privacy.shareProfileHint")}
            checked={current.shareProfile}
            onCheckedChange={(checked) => update({ shareProfile: checked })}
          />
          <SettingToggle
            title={t("privacy.shareStats")}
            description={t("privacy.shareStatsHint")}
            checked={current.shareStats}
            onCheckedChange={(checked) => update({ shareStats: checked })}
          />
          <SettingToggle
            title={t("privacy.shareLocker")}
            description={t("privacy.shareLockerHint")}
            checked={current.shareLocker}
            onCheckedChange={(checked) => update({ shareLocker: checked })}
          />
          <SettingToggle
            title={t("privacy.allowRequests")}
            description={t("privacy.allowRequestsHint")}
            checked={current.allowRequests}
            onCheckedChange={(checked) => update({ allowRequests: checked })}
          />
        </>
      )}

      {/*
       * Only while a write is in flight. The static "these live on the server"
       * note was removed on request; the feedback that matters is whether the
       * switch you just flipped has been stored yet.
       */}
      {saving && (
        <div className="flex items-center gap-2 px-1 text-[0.75rem] text-ink-3">
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          <p>{t("privacy.saving")}</p>
        </div>
      )}
    </div>
  );
}
