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
  Zap,
  BookOpen,
  Target,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillNode } from "./skillTreeData";

interface SkillNodeModalProps {
  node: SkillNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartDrill?: (node: SkillNode) => void;
}

export function SkillNodeModal({
  node,
  open,
  onOpenChange,
  onStartDrill,
}: SkillNodeModalProps) {
  if (!node) return null;

  const statusBadges: Record<SkillNode["status"], { label: string; style: string }> = {
    unlocked: {
      label: "Mastered",
      style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    "in-progress": {
      label: "In Progress",
      style: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    locked: {
      label: "Locked",
      style: "bg-muted text-muted-foreground border-border",
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={true}
        className="max-w-xl bg-popover text-popover-foreground border-border rounded-xl p-6 shadow-xl space-y-4"
      >
        {/* Header */}
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {node.category.toUpperCase()} • Tier {node.tier}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-medium border rounded-md",
                statusBadges[node.status].style
              )}
            >
              {statusBadges[node.status].label}
            </span>
          </div>

          <DialogTitle className="text-xl font-bold text-foreground">
            {node.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {node.subtitle}
          </DialogDescription>
        </DialogHeader>

        {/* Technical Mastery Bar */}
        <div className="space-y-1.5 p-3 rounded-lg bg-card border border-border">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Technical Mastery</span>
            <span className="text-foreground font-mono">{node.masteryPercentage}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${node.masteryPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Reward: +{node.xpReward} XP</span>
            <span>Target: 100% execution consistency</span>
          </div>
        </div>

        {/* Speedcubing Theory */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Technical Speedcubing Concept
          </h4>
          <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-md border border-border/50">
            {node.theory}
          </p>
        </div>

        {/* Model Formula / Insertion */}
        {node.exampleFormula && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Model Sequence / Insertion
            </h4>
            <div className="p-2.5 bg-card border border-border rounded-md font-mono text-sm text-foreground font-semibold text-center tracking-wide">
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
                  className="px-2 py-1 text-xs font-medium bg-muted border border-border rounded text-muted-foreground flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {req}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Drills */}
        {node.recommendedDrills.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Recommended Practice Drills
            </h4>
            <ul className="space-y-1">
              {node.recommendedDrills.map((drill) => (
                <li
                  key={drill}
                  className="text-xs text-foreground/80 flex items-center gap-2 p-2 rounded bg-card/40 border border-border/40"
                >
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  <span>{drill}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              onStartDrill?.(node);
              onOpenChange(false);
            }}
          >
            <Sparkles className="w-3.5 h-3.5" /> Practice This Skill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
