import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  BookOpen,
  Target,
  ArrowRight,
  Code2,
  Check,
  RotateCcw,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillNode } from "./skillTreeData";

interface SkillNodeModalProps {
  node: SkillNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartDrill?: (node: SkillNode) => void;
  onToggleComplete?: (nodeId: string) => void;
}

export function SkillNodeModal({
  node,
  open,
  onOpenChange,
  onStartDrill,
  onToggleComplete,
}: SkillNodeModalProps) {
  if (!node) return null;

  const isCompleted = node.status === "completed";
  const isLocked = node.status === "locked";

  const statusBadges: Record<SkillNode["status"], { label: string; style: string }> = {
    completed: {
      label: "Completed",
      style: "bg-ink text-surface font-bold border-ink",
    },
    unlocked: {
      label: "Accessible",
      style: "bg-surface-2 text-ink border-line font-semibold",
    },
    locked: {
      label: "Locked",
      style: "bg-surface-2 text-ink-3 border-line",
    },
  };

  const badge = statusBadges[node.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={true}
        className="max-w-xl bg-surface text-ink border-line rounded-xl p-6 shadow-2xl space-y-4"
      >
        {/* Header */}
        <DialogHeader className="space-y-1 text-left pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold tracking-wider text-ink-3 uppercase">
              {node.category.toUpperCase()} • TIER {node.tier.toUpperCase()}
            </span>
            <span
              className={cn(
                "px-2.5 py-0.5 text-xs border rounded-md transition-colors",
                badge.style
              )}
            >
              {badge.label}
            </span>
          </div>

          <DialogTitle className="text-xl font-bold text-ink tracking-tight flex items-center justify-between">
            <span>{node.title}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-3">
            {node.subtitle}
          </DialogDescription>
        </DialogHeader>

        {/* Speedcubing Theory Explanation */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-ink" /> Speedcubing Theory & Key Concept
          </h4>
          <p className="text-xs text-ink/90 leading-relaxed bg-surface-2/30 p-3 rounded-lg border border-line/60">
            {node.theory}
          </p>
        </div>

        {/* Full Description */}
        <div className="text-xs text-ink-3 leading-relaxed px-1">
          {node.description}
        </div>

        {/* Model Formula / Insertion */}
        {node.exampleFormula && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-ink" /> Model Formula / Example Sequence
            </h4>
            <div className="p-3 bg-surface border border-line rounded-lg font-mono text-xs text-ink font-semibold text-center tracking-wide select-all shadow-inner">
              {node.exampleFormula}
            </div>
          </div>
        )}

        {/* Prerequisites */}
        {node.prerequisites.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              Prerequisites
            </h4>
            <div className="flex flex-wrap gap-2">
              {node.prerequisites.map((req) => (
                <span
                  key={req}
                  className="px-2.5 py-1 text-xs bg-surface-2/40 border border-line rounded-md text-ink-3 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-ink" /> {req}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Drills */}
        {node.recommendedDrills.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-ink" /> Recommended Practice Drills
            </h4>
            <ul className="space-y-1.5">
              {node.recommendedDrills.map((drill) => (
                <li
                  key={drill}
                  className="text-xs text-ink/90 flex items-center gap-2 p-2.5 rounded-lg bg-surface/60 border border-line/60"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-ink shrink-0" />
                  <span>{drill}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-3">
          {/* Toggle Complete Button */}
          {!isLocked ? (
            <Button
              variant={isCompleted ? "outline" : "default"}
              size="sm"
              onClick={() => onToggleComplete?.(node.id)}
              className={cn(
                "text-xs font-semibold gap-1.5 transition-all",
                isCompleted
                  ? "border-ink/40 text-ink hover:bg-surface-2"
                  : "bg-ink text-surface hover:bg-ink/90 font-bold shadow-md"
              )}
            >
              {isCompleted ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" /> Mark as Incomplete
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Mark as Completed
                </>
              )}
            </Button>
          ) : (
            <span className="text-xs text-ink-3 italic flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> Locked: complete prerequisites to unlock
            </span>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              disabled={isLocked}
              className="text-xs font-semibold gap-1"
              onClick={() => {
                onStartDrill?.(node);
                onOpenChange(false);
              }}
            >
              Practice Skill
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


