"use client";

/**
 * ProfileFriendsPanel — the friends shortcut living in the profile sidebar.
 *
 * Replaces the old quick-action buttons: instead of duplicating the main nav,
 * the secondary column shows who you can visit. Opening a friend navigates to
 * the Friends view with that friend selected (via `requestFriendSelection`),
 * so the full detail — tabs, management, confirm dialogs — lives in exactly
 * one place.
 *
 * Gating without a migration: the directory does not carry `share_profile`,
 * so each tap checks `friend_profile` first (one RPC, only on tap — never
 * N+1). Shared → navigate and open. Not shared → the row shows a lock and a
 * toast explains why, and nothing opens.
 *
 * Signed-out users get a compact pointer to the Friends view, which owns the
 * full sign-in flow.
 */

import { useState } from "react";
import { ChevronRight, Loader2, Lock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useAccount } from "@/hooks/useAccount";
import { useFriendDirectory } from "@/hooks/useFriends";
import { FriendAvatar } from "@/views/Friends/components/FriendAvatar";
import { requestFriendSelection } from "@/views/Friends/friendSelection";
import { displayNameOf, FRIEND_FAILURE_KEY } from "@/views/Friends/friendsCopy";
import { fetchFriendProfile } from "@/services/friends";
import { getSupabaseClient } from "@/services/sync";
import type { ViewId } from "@/components/Layout/sidebar.constants";

export interface ProfileFriendsPanelProps {
  onNavigate?: (view: ViewId) => void;
  /** Opens Settings pre-selected to *Privacidad y amigos*. */
  onOpenPrivacySettings?: () => void;
  className?: string;
}

export function ProfileFriendsPanel({
  onNavigate,
  onOpenPrivacySettings,
  className,
}: ProfileFriendsPanelProps) {
  const { t } = useTranslation("profile");
  const { t: tFriends } = useTranslation("friends");
  const { user } = useAccount();
  const { data, loading, error } = useFriendDirectory({ enabled: Boolean(user) });
  const [checking, setChecking] = useState<string | null>(null);
  const [locked, setLocked] = useState<ReadonlySet<string>>(new Set());

  /**
   * Open a friend in the Friends view — but only when they share their
   * profile. The check is per-tap (one RPC), so a friend who turns sharing on
   * later opens on the next tap with no refresh needed.
   */
  async function openFriend(userId: string) {
    if (checking) return;
    setChecking(userId);
    try {
      const res = await fetchFriendProfile(getSupabaseClient(), userId);
      if (!res.ok) {
        if (res.reason === "not_shared") {
          setLocked((prev) => new Set(prev).add(userId));
        }
        toast.error(tFriends(FRIEND_FAILURE_KEY[res.reason]));
        return;
      }
      setLocked((prev) => {
        if (!prev.has(userId)) return prev;
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      requestFriendSelection(userId);
      onNavigate?.("friends");
    } finally {
      setChecking(null);
    }
  }

  const friends = data?.friends ?? [];

  return (
    <section className={className}>
      {/* Same height as the content TabsList (h-8 triggers + py-1.5 = h-11)
          with the same mt-4 gap below, so both columns start symmetric. */}
      <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-2">
        <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
          {t("friends.title")}
          {data && friends.length > 0 && <span className="nums"> ({friends.length})</span>}
        </h2>
        <div className="flex items-center gap-3">
          {onOpenPrivacySettings && user && (
            <button
              type="button"
              onClick={onOpenPrivacySettings}
              className="cursor-pointer text-[0.68rem] text-ink-3 underline decoration-dotted transition-colors hover:text-ink"
            >
              {tFriends("sharing.shortcut")}
            </button>
          )}
          {onNavigate && friends.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("friends")}
              className="cursor-pointer text-[0.68rem] font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              {t("friends.viewAll")}
            </button>
          )}
        </div>
      </div>

      {!user ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2/60 text-ink-3">
              <Users className="size-4" aria-hidden="true" />
            </div>
            <p className="min-w-0 flex-1 text-[0.75rem] leading-5 text-ink-3">
              {t("friends.signedOut")}
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("friends")}
              className="mt-3 inline-flex h-8 cursor-pointer items-center rounded-lg border border-line px-3 text-[0.72rem] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {t("friends.openFriends")}
            </button>
          )}
        </div>
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="mb-2 rounded-xl border border-line bg-surface p-3 text-[0.75rem] text-dnf"
            >
              {tFriends(FRIEND_FAILURE_KEY[error])}
            </p>
          )}

          {loading && !data ? (
            <div className="flex justify-center rounded-xl border border-line bg-surface py-8">
              <Spinner size="sm" label={tFriends("loading")} />
            </div>
          ) : friends.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
              <div className="mx-auto grid size-9 place-items-center rounded-xl border border-line bg-surface-2/50 text-ink-3">
                <Users className="size-4" aria-hidden="true" />
              </div>
              <p className="mt-2 text-[0.8rem] font-semibold text-ink">{t("friends.empty")}</p>
              <p className="mx-auto mt-1 max-w-xs text-[0.72rem] leading-4 text-ink-3">
                {t("friends.emptyHint")}
              </p>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("friends")}
                  className="mt-3 inline-flex h-8 cursor-pointer items-center rounded-lg border border-line bg-surface px-3 text-[0.72rem] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {t("friends.openFriends")}
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {friends.map((entry) => {
                const name = displayNameOf(entry.profile);
                const isLocked = locked.has(entry.profile.userId);
                const isChecking = checking === entry.profile.userId;
                return (
                  <li key={entry.profile.userId}>
                    <button
                      type="button"
                      disabled={isChecking}
                      onClick={() => void openFriend(entry.profile.userId)}
                      aria-label={name || tFriends("card.unnamed")}
                      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-ink-2/40 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-wait"
                    >
                      <FriendAvatar profile={entry.profile} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8rem] font-semibold text-ink">
                          {name || tFriends("card.unnamed")}
                        </span>
                        <span className="block truncate font-mono text-[0.68rem] text-ink-3">
                          {entry.profile.handle
                            ? `@${entry.profile.handle}`
                            : tFriends("card.noHandle")}
                        </span>
                      </span>
                      {isChecking ? (
                        <Loader2
                          className="size-4 shrink-0 animate-spin text-ink-3"
                          aria-hidden="true"
                        />
                      ) : isLocked ? (
                        <Lock className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                      ) : (
                        <ChevronRight
                          className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
