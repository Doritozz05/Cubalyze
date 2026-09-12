"use client";

/**
 * FriendCard — one friend, and the three things you can do about it.
 *
 * The badges (`shares.locker`, `shares.stats`) are not decoration: they are
 * what makes "por qué no veo su armario" answerable before a click. They come
 * from the server's `friend_list` (the friend's own visibility row), so they
 * are the truth at read time, not a guess.
 *
 * Management is deliberately two levels: opening the profile is the primary
 * action (whole card is a button), and the destructive ones live behind a
 * menu so "bloquear" is never one mis-tap away from "abrir".
 */

import { MoreVertical, Package, Star, UserMinus, Ban } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FriendAvatar } from "./FriendAvatar";
import { displayNameOf } from "../friendsCopy";
import { cn } from "@/lib/utils";
import type { FriendEntry } from "@/services/friends";

export interface FriendCardProps {
  entry: FriendEntry;
  onOpen: (userId: string) => void;
  onRemove: (userId: string) => void;
  onBlock: (userId: string) => void;
  busy?: boolean;
}

export function FriendCard({ entry, onOpen, onRemove, onBlock, busy = false }: FriendCardProps) {
  const { t } = useTranslation("friends");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { profile, shares } = entry;
  const name = displayNameOf(profile);

  // Close on outside click / Escape: a menu that can only be closed by the
  // same button is a trap on touch.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (ev: MouseEvent) => {
      if (!menuRef.current?.contains(ev.target as Node)) setMenuOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors",
        "hover:border-ink-2/40",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(profile.userId)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 rounded-lg"
      >
        <FriendAvatar profile={profile} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.85rem] font-semibold text-ink">
            {name || t("card.unnamed")}
          </p>
          <p className="truncate font-mono text-[0.7rem] text-ink-3">
            {profile.handle ? `@${profile.handle}` : t("card.noHandle")}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {shares.locker && (
              <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2/50 px-1.5 py-0.5 text-[0.6rem] text-ink-2">
                <Package className="size-3" aria-hidden="true" />
                {t("card.sharesLocker")}
              </span>
            )}
            {shares.stats && (
              <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2/50 px-1.5 py-0.5 text-[0.6rem] text-ink-2">
                <Star className="size-3" aria-hidden="true" />
                {t("card.sharesStats")}
              </span>
            )}
            {!shares.locker && !shares.stats && (
              <span className="text-[0.6rem] text-ink-3">{t("card.sharesIdentity")}</span>
            )}
          </div>
        </div>
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label={t("card.actions", { name: name || profile.handle })}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="grid size-8 cursor-pointer place-items-center rounded-lg border border-transparent text-ink-3 transition-colors hover:border-line hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setMenuOpen(false);
                onRemove(profile.userId);
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[0.78rem] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              <UserMinus className="size-3.5" aria-hidden="true" />
              {t("card.remove")}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setMenuOpen(false);
                onBlock(profile.userId);
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[0.78rem] text-dnf transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              <Ban className="size-3.5" aria-hidden="true" />
              {t("card.block")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
