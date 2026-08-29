"use client";

import { useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/** Clean Moves Sequence with subtle AUF pill and quiet copy */
export function MovesSeq({
  tokens,
  aufMoves,
}: {
  tokens: string[] | null;
  aufMoves?: string[];
}) {
  const { t } = useTranslation("reconstructions");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!tokens || tokens.length === 0) return;
      try {
        await navigator.clipboard.writeText(tokens.join(" "));
        setCopied(true);
        toast.success(t("detection.copiedAlg"));
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard unavailable */
      }
    },
    [tokens, t],
  );

  if (!tokens || tokens.length === 0) {
    return <span className="text-[0.74rem] text-ink-3">—</span>;
  }

  return (
    <div className="group/seq flex min-w-0 items-center gap-2">
      <span className="min-w-0 wrap-break-word whitespace-normal font-mono text-[0.74rem] font-medium text-ink leading-relaxed">
        {tokens.join(" ")}
      </span>

      {aufMoves && aufMoves.length > 0 && (
        <span className="shrink-0 rounded border border-line bg-surface-2 px-1 py-0.5 font-mono text-[0.54rem] text-ink-3">
          {t("detection.auf", { moves: aufMoves.join(" ") })}
        </span>
      )}

      <button
        type="button"
        onClick={handleCopy}
        title={t("detection.copyAlg")}
        aria-label={t("detection.copyAlg")}
        className="opacity-0 group-hover/seq:opacity-100 transition-opacity p-0.5 rounded text-ink-3 hover:text-ink hover:bg-surface-3 cursor-pointer shrink-0"
      >
        {copied ? (
          <Check className="size-3 text-ready" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  );
}
