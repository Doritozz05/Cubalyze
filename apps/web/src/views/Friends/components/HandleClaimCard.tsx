"use client";

/**
 * HandleClaimCard — where a public identity is born.
 *
 * A handle is not a profile field: it is a claim on a unique name, and only
 * the server can grant it. So this card has exactly one job — take a name,
 * ask the server, and say honestly what happened:
 *
 *  - `taken`   → "ese ya está pillado", and we offer the server's suggestion
 *                as a one-click alternative (the suggestion comes from the
 *                server so it is guaranteed free at the moment it was built).
 *  - `invalid` → the canonical format rules, in the user's words.
 *  - `offline` → "no pudimos comprobarlo"; nothing was written, and the name
 *                is still free as far as we know.
 *  - `unauthorized` → the session is gone; the fix is signing in again, which
 *                is a different instruction from "check your connection".
 *
 * The input is normalised for display (`@`, lowercase) but the SERVER decides:
 * a client that pre-validates is a convenience, never the rule. This is also
 * why the card never writes the profile row itself — `claimHandle` does, with
 * the server's seal.
 */

import { useState } from "react";
import { AtSign, Check, Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHandle } from "@/hooks/useFriends";
import { cn } from "@/lib/utils";

export interface HandleClaimCardProps {
  /** The handle already in the local profile ('' when none yet). */
  current: string;
  className?: string;
}

export function HandleClaimCard({ current, className }: HandleClaimCardProps) {
  const { t } = useTranslation("friends");
  const { claim, busy } = useHandle();
  const [value, setValue] = useState("");
  const [error, setError] = useState<"taken" | "invalid" | "offline" | "unauthorized" | null>(
    null,
  );
  const [suggestion, setSuggestion] = useState<string | null>(null);

  async function submit(raw: string) {
    const candidate = raw.trim();
    if (candidate === "") return;
    setError(null);
    setSuggestion(null);
    const res = await claim(candidate);
    if (res.ok) {
      setValue("");
      return;
    }
    setError(res.reason);
    setSuggestion(res.reason === "taken" ? (res.suggestion ?? null) : null);
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-surface p-4 sm:p-5",
        className,
      )}
      aria-labelledby="handle-claim-title"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2/60 text-ink-2">
          <AtSign className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="handle-claim-title"
            className="text-[0.85rem] font-semibold text-ink"
          >
            {t("handle.title")}
          </h2>
          <p className="mt-1 text-[0.78rem] leading-5 text-ink-3">
            {t("handle.description")}
          </p>

          {current ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-1.5 text-[0.82rem] text-ink">
              <Check className="size-3.5 text-ready" aria-hidden="true" />
              <span className="font-mono">@{current}</span>
            </p>
          ) : (
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(value);
              }}
            >
              <div className="flex h-9 min-w-0 flex-1 items-center gap-1 rounded-lg border border-line bg-surface-2/50 px-2.5 focus-within:border-ink/30">
                <span className="text-[0.82rem] text-ink-3">@</span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={t("handle.placeholder")}
                  aria-label={t("handle.title")}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={20}
                  className="min-w-0 flex-1 bg-transparent text-[0.82rem] font-mono text-ink outline-none placeholder:text-ink-3"
                />
              </div>
              <button
                type="submit"
                disabled={busy || value.trim() === ""}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-3 text-xs font-semibold text-surface transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {t("handle.claim")}
              </button>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-2 text-[0.75rem] text-dnf">
              {t(`handle.error.${error}`)}
            </p>
          )}

          {suggestion && (
            <button
              type="button"
              onClick={() => void submit(suggestion)}
              disabled={busy}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-1.5 text-[0.75rem] text-ink-2 transition-colors hover:border-ink-2/40 hover:text-ink disabled:opacity-50"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              {t("handle.trySuggestion", { handle: suggestion })}
            </button>
          )}

          <p className="mt-3 text-[0.68rem] leading-4 text-ink-3">{t("handle.rules")}</p>
        </div>
      </div>
    </section>
  );
}
