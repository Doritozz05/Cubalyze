"use client";

/**
 * RequestsPanels — the two pending sides of a friendship.
 *
 * Incoming: the only place where a request can be accepted. Accepting and
 * declining are different verbs about the same row, so they are separate
 * buttons, not a menu.
 *
 * Outgoing: cancellation matters more than it looks — a request that cannot be
 * withdrawn is a request you regret. It disappears without a trace (the server
 * deletes the row), so the other person never learns it existed.
 *
 * Blocking from an incoming request is offered because it is the honest answer
 * to "stop this happening again": declining deletes the row and the person can
 * ask again, blocking is what actually closes the door. (And unblocking does
 * NOT restore anything — decision D3.)
 */

import { Ban, Check, Clock, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FriendAvatar } from "./FriendAvatar";
import { displayNameOf } from "../friendsCopy";
import type { FriendRequestEntry } from "@/services/friends";

export interface RequestsPanelsProps {
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
  busy: boolean;
  onAccept: (userId: string) => void;
  onDecline: (userId: string) => void;
  onCancel: (userId: string) => void;
  onBlock: (userId: string) => void;
}

export function RequestsPanels({
  incoming,
  outgoing,
  busy,
  onAccept,
  onDecline,
  onCancel,
  onBlock,
}: RequestsPanelsProps) {
  const { t, i18n } = useTranslation("friends");

  const formatDate = (ms: number) =>
    ms > 0
      ? new Date(ms).toLocaleDateString(i18n.language, {
          day: "numeric",
          month: "short",
        })
      : "";

  return (
    <div className="space-y-4">
      <section aria-labelledby="incoming-title" className="space-y-2">
        <h2
          id="incoming-title"
          className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3"
        >
          {t("requests.incoming")}
        </h2>
        {incoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[0.78rem] text-ink-3">
            {t("requests.noIncoming")}
          </p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((req) => {
              const name = displayNameOf(req.profile) || t("card.unnamed");
              return (
                <li
                  key={req.profile.userId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3"
                >
                  <FriendAvatar profile={req.profile} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.85rem] font-semibold text-ink">{name}</p>
                    <p className="truncate font-mono text-[0.7rem] text-ink-3">
                      {req.profile.handle ? `@${req.profile.handle}` : t("card.noHandle")}
                    </p>
                    {req.message && (
                      <p className="mt-1 line-clamp-2 text-[0.72rem] italic text-ink-2">
                        “{req.message}”
                      </p>
                    )}
                    {req.createdAt > 0 && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[0.65rem] text-ink-3">
                        <Clock className="size-3" aria-hidden="true" />
                        {formatDate(req.createdAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onAccept(req.profile.userId)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-ink px-3 text-[0.72rem] font-semibold text-surface transition-colors hover:bg-ink/90 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="size-3.5" aria-hidden="true" />
                      )}
                      {t("requests.accept")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDecline(req.profile.userId)}
                      aria-label={t("requests.decline")}
                      className="grid size-8 cursor-pointer place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onBlock(req.profile.userId)}
                      aria-label={t("card.block")}
                      className="grid size-8 cursor-pointer place-items-center rounded-lg border border-line text-dnf transition-colors hover:bg-surface-2 disabled:opacity-50"
                    >
                      <Ban className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="outgoing-title" className="space-y-2">
        <h2
          id="outgoing-title"
          className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3"
        >
          {t("requests.outgoing")}
        </h2>
        {outgoing.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[0.78rem] text-ink-3">
            {t("requests.noOutgoing")}
          </p>
        ) : (
          <ul className="space-y-2">
            {outgoing.map((req) => {
              const name = displayNameOf(req.profile) || t("card.unnamed");
              return (
                <li
                  key={req.profile.userId}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
                >
                  <FriendAvatar profile={req.profile} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.82rem] text-ink">{name}</p>
                    <p className="truncate font-mono text-[0.68rem] text-ink-3">
                      {req.profile.handle ? `@${req.profile.handle}` : t("card.noHandle")}
                    </p>
                  </div>
                  <span className="text-[0.65rem] uppercase tracking-wide text-ink-3">
                    {t("requests.pending")}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onCancel(req.profile.userId)}
                    className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-line px-3 text-[0.72rem] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    {t("requests.cancel")}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
