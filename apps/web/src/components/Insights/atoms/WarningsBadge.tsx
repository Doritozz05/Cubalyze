"use client";

import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Warning counter chip with a tooltip listing every detection warning.
 * Shared by the reconstruction panel and the insights panel; renders
 * nothing when there are no warnings.
 */
export function WarningsBadge({
  warnings,
  className,
}: {
  warnings: readonly string[];
  className?: string;
}) {
  if (warnings.length === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "flex items-center gap-1 rounded border border-caution/40 bg-caution/10 px-1.5 py-0.5 text-[0.58rem] font-semibold text-caution cursor-help",
            className,
          )}
        >
          <TriangleAlert className="size-3" />
          {warnings.length}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <ul className="list-disc pl-4 font-mono text-[0.62rem]">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
