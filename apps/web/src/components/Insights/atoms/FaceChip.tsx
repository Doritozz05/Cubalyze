"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FACE_HEX, colorName } from "./faceColors";

/**
 * Small colored chip for a cube face letter (U/R/F/D/L/B), with the color
 * name on hover. Shared by the reconstruction panel (F2L pair colors,
 * orientation row) and the insights panel.
 */
export function FaceChip({ face, className }: { face: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-block size-2.5 rounded-sm ring-1 ring-black/30 cursor-help",
            className,
          )}
          style={{ background: FACE_HEX[face] ?? "#6b7280" }}
        />
      </TooltipTrigger>
      <TooltipContent side="top">{colorName(face)}</TooltipContent>
    </Tooltip>
  );
}
