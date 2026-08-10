"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Coherent / Inconsistent verdict badge — the same data (the detection
 * report's finalStateSolved) shown by the reconstruction panel and the
 * insights panel, so a solve reads identically in both places.
 */
export function CoherenceBadge({
  coherent,
  className,
}: {
  coherent: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.58rem] font-medium",
        coherent
          ? "border-ready/40 bg-ready/10 text-ready"
          : "border-caution/40 bg-caution/10 text-caution",
        className,
      )}
    >
      {coherent ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
      {coherent ? "Coherent" : "Inconsistent"}
    </span>
  );
}
