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
      style: "bg-foreground text-background font-bold border-foreground",
    },
    unlocked: {
      label: "Accessible",
      style: "bg-muted text-foreground border-border font-semibold",
    },
    locked: {
      label: "Locked",
      style: "bg-muted text-muted-foreground border-border",
    },
  };

  const badge = statusBadges[node.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={true}
        className="max-w-xl bg-popover text-popover-foreground border-border rounded-xl p-6 shadow-2xl space-y-4"
      >
        {/* Header */}
        <DialogHeader className="space-y-1 text-left pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
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

          <DialogTitle className="text-xl font-bold text-foreground tracking-tight flex items-center justify-between">
            <span>{node.title}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {node.subtitle}
          </DialogDescription>
        </DialogHeader>

        {/* Speedcubing Theory Explanation */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-foreground" /> Speedcubing Theory & Key Concept
          </h4>
          <p className="text-xs text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/60">
            {node.theory}
          </p>
        </div>

        {/* Full Description */}
        <div className="text-xs text-muted-foreground leading-relaxed px-1">
          {node.description}
        </div>

        {/* Model Formula / Insertion */}
        {node.exampleFormula && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-foreground" /> Model Formula / Example Sequence
            </h4>
            <div className="p-3 bg-card border border-border rounded-lg font-mono text-xs text-foreground font-semibold text-center tracking-wide select-all shadow-inner">
              {node.exampleFormula}
            </div>
          </div>
        )}

        {/* Prerequisites */}
        {node.prerequisites.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prerequisites
            </h4>
            <div className="flex flex-wrap gap-2">
              {node.prerequisites.map((req) => (
                <span
                  key={req}
                  className="px-2.5 py-1 text-xs bg-muted/40 border border-border rounded-md text-muted-foreground flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-foreground" /> {req}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Drills */}
        {node.recommendedDrills.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-foreground" /> Recommended Practice Drills
            </h4>
            <ul className="space-y-1.5">
              {node.recommendedDrills.map((drill) => (
                <li
                  key={drill}
                  className="text-xs text-foreground/90 flex items-center gap-2 p-2.5 rounded-lg bg-card/60 border border-border/60"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-foreground shrink-0" />
                  <span>{drill}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
          {/* Toggle Complete Button */}
          {!isLocked ? (
            <Button
              variant={isCompleted ? "outline" : "default"}
              size="sm"
              onClick={() => onToggleComplete?.(node.id)}
              className={cn(
                "text-xs font-semibold gap-1.5 transition-all",
                isCompleted
                  ? "border-foreground/40 text-foreground hover:bg-muted"
                  : "bg-foreground text-background hover:bg-foreground/90 font-bold shadow-md"
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
            <span className="text-xs text-muted-foreground italic flex items-center gap-1">
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


