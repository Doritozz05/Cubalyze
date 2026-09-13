"use client";

/**
 * AddFriendForm — send a friend request by exact handle.
 *
 * Every refusal the server can answer has its own sentence, because they mean
 * genuinely different things to the person typing:
 *
 *   not_found       nobody has that handle (or they blocked you — the server
 *                   answers the same on purpose, so blocking stays invisible)
 *   self            it is your own handle
 *   closed          they turned requests off
 *   already_friends you two are already friends
 *   pending         you already asked; repeating it does not nudge them
 *   rate_limited    too many requests today
 *   invalid         the handle cannot exist in that form
 *
 * `accepted: true` is the delightful case: the other person had already asked
 * YOU, so mutual intent makes it a friendship immediately (decision D1) — no
 * second click, and the copy says so instead of pretending a request was sent.
 *
 * The form never guesses availability: there is no "búsqueda" step, because a
 * prefix search would let anyone enumerate the user base. The request either
 * resolves to a person or it does not.
 */

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFriendActions } from "@/hooks/useFriends";
import { FRIEND_FAILURE_KEY } from "../friendsCopy";
import type { FriendsFailure } from "@/services/friends";

export interface AddFriendFormProps {
  /** Called with the new friend's id when a request auto-accepted. */
  onAccepted?: (userId: string) => void;
  className?: string;
}

export function AddFriendForm({ onAccepted, className }: AddFriendFormProps) {
  const { t } = useTranslation("friends");
  const { sendRequest, busy } = useFriendActions();
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<
    { kind: "sent" } | { kind: "accepted"; userId: string } | { kind: "error"; reason: FriendsFailure } | null
  >(null);

  async function submit() {
    const handle = value.trim();
    if (handle === "") return;
    setFeedback(null);
    const res = await sendRequest(handle);
    if (!res.ok) {
      setFeedback({ kind: "error", reason: res.reason });
      return;
    }
    setValue("");
    if (res.data.accepted) {
      setFeedback({ kind: "accepted", userId: res.data.target?.userId ?? "" });
      if (res.data.target?.userId) onAccepted?.(res.data.target.userId);
    } else {
      setFeedback({ kind: "sent" });
    }
  }

  return (
    <section className={className}>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-xl border border-line bg-surface px-3 focus-within:border-ink/30">
          <span className="text-[0.85rem] text-ink-3">@</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("add.placeholder")}
            aria-label={t("add.label")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            className="min-w-0 flex-1 bg-transparent text-[0.85rem] font-mono text-ink outline-none placeholder:font-sans placeholder:text-ink-3"
          />
        </div>
        <button
          type="submit"
          disabled={busy || value.trim() === ""}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-surface transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus className="size-4" aria-hidden="true" />
          )}
          {t("add.submit")}
        </button>
      </form>

      {feedback?.kind === "sent" && (
        <p role="status" className="mt-2 text-[0.75rem] text-ink-2">
          {t("add.sent")}
        </p>
      )}
      {feedback?.kind === "accepted" && (
        <p role="status" className="mt-2 text-[0.75rem] text-ready">
          {t("add.accepted")}
        </p>
      )}
      {feedback?.kind === "error" && (
        <p role="alert" className="mt-2 text-[0.75rem] text-dnf">
          {t(FRIEND_FAILURE_KEY[feedback.reason])}
        </p>
      )}
    </section>
  );
}
