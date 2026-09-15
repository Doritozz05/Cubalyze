import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CrossSolverService, type CubeFace } from "@cubalyze/solver-engine";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CrossFace } from "../types";

interface CrossSolverSlotProps {
  scramble?: string;
  defaultFace?: CrossFace;
  className?: string;
}

interface FaceMeta {
  face: CubeFace;
  labelKey:
    | "crossFaceWhite"
    | "crossFaceYellow"
    | "crossFaceGreen"
    | "crossFaceBlue"
    | "crossFaceOrange"
    | "crossFaceRed";
  fallbackLabel: string;
  colorHex: string;
}

const FACES: FaceMeta[] = [
  { face: "U", labelKey: "crossFaceWhite", fallbackLabel: "White", colorHex: "#ffffff" },
  { face: "D", labelKey: "crossFaceYellow", fallbackLabel: "Yellow", colorHex: "#facc15" },
  { face: "F", labelKey: "crossFaceGreen", fallbackLabel: "Green", colorHex: "#22c55e" },
  { face: "B", labelKey: "crossFaceBlue", fallbackLabel: "Blue", colorHex: "#3b82f6" },
  { face: "L", labelKey: "crossFaceOrange", fallbackLabel: "Orange", colorHex: "#f97316" },
  { face: "R", labelKey: "crossFaceRed", fallbackLabel: "Red", colorHex: "#ef4444" },
];

export function CrossSolverSlot({
  scramble = "",
  defaultFace = "U",
  className,
}: CrossSolverSlotProps) {
  const { t } = useTranslation("timer");
  const [selectedFace, setSelectedFace] = useState<CubeFace>(defaultFace as CubeFace);

  const solutionResult = useMemo(() => {
    return CrossSolverService.solve(scramble, {
      face: selectedFace,
      maxSolutions: 2,
    });
  }, [scramble, selectedFace]);

  const { solutions, bestColorNeutral } = solutionResult;
  const bestFaceMeta = bestColorNeutral ? FACES.find((f) => f.face === bestColorNeutral.face) : undefined;
  const bestFaceName = bestFaceMeta ? t(bestFaceMeta.labelKey, { defaultValue: bestFaceMeta.fallbackLabel }) : bestColorNeutral?.face;

  return (
    <div className={cn("flex size-full flex-col justify-between gap-1.5 min-w-0 p-1", className)}>
      {/* Face selector with visual colors & Radix Tooltip */}
      <div className="flex items-center justify-between gap-1 pb-1 border-b border-line/40">
        <span className="text-[0.6rem] font-medium tracking-wider uppercase text-ink-3">
          {t("crossTitle", { defaultValue: "Cross" })}
        </span>
        <div className="flex items-center gap-1">
          {FACES.map((f) => {
            const isSelected = selectedFace === f.face;
            const faceName = t(f.labelKey, { defaultValue: f.fallbackLabel });
            return (
              <Tooltip key={f.face}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSelectedFace(f.face)}
                    className={cn(
                      "relative flex size-4 sm:size-4.5 items-center justify-center rounded-full border transition-all cursor-pointer",
                      isSelected
                        ? "ring-1.5 ring-ink/80 border-surface scale-110 shadow-xs"
                        : "border-black/20 opacity-60 hover:opacity-100 hover:scale-105",
                    )}
                    style={{ backgroundColor: f.colorHex }}
                  >
                    <span className="sr-only">{faceName}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t("crossFaceTooltip", { face: faceName, defaultValue: `Cross on ${faceName}` })}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Solutions list — clean & minimalist */}
      <div className="flex flex-1 flex-col justify-center gap-1">
        {solutions.length === 0 ? (
          <div className="text-center text-[0.7rem] text-ink-3 py-1">
            {scramble
              ? t("crossSearching", { defaultValue: "Searching solution..." })
              : t("crossSolved", { defaultValue: "Solved" })}
          </div>
        ) : (
          solutions.map((sol, i) => {
            const movesText = sol.moves || sol.notation || "";
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md bg-surface-2/40 px-2 py-1 border border-line/40 min-w-0"
              >
                <span className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[0.56rem] font-semibold text-ink-2 shrink-0">
                  {sol.moveCount}m
                </span>
                <span className="nums truncate font-mono text-[0.78rem] font-medium text-ink select-all min-w-0 flex-1">
                  {sol.preRotation && (
                    <span className="font-bold text-ready mr-1.5">
                      [{sol.preRotation}]
                    </span>
                  )}
                  {movesText || (sol.moveCount === 0 ? t("crossSolved", { defaultValue: "Solved" }) : "")}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Color-neutral insight: if another face has a better cross (minimal left-aligned text, no pill) */}
      {bestColorNeutral && bestColorNeutral.face !== selectedFace && (
        <div className="flex items-center justify-start pt-0.5">
          <button
            type="button"
            onClick={() => setSelectedFace(bestColorNeutral.face)}
            className="group flex items-center gap-1.5 text-[0.62rem] text-ink-3 hover:text-ink transition-colors cursor-pointer"
          >
            <span
              className="size-2 rounded-full border border-black/20 shrink-0"
              style={{ backgroundColor: bestFaceMeta?.colorHex }}
            />
            <span className="truncate">
              {t("bestCrossSuggestion", {
                face: bestFaceName,
                count: bestColorNeutral.depth,
                defaultValue: `Best: ${bestFaceName} (${bestColorNeutral.depth}m)`,
              })}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

