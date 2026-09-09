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
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { cn } from "@/lib/utils";
import { TOUCH_FULL_BLEED } from "@/lib/touch";
import { CATEGORY_KEY, NODE_BY_ID, STATUS_KEY, TIER_KEY, type SkillNode } from "./skillTreeData";

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
  const { t, i18n } = useTranslation("skillTree");
  if (!node) return null;

  const isCompleted = node.status === "completed";
  const isLocked = node.status === "locked";

  const statusBadges: Record<SkillNode["status"], { labelKey: ParseKeys<"skillTree">; style: string }> = {
    completed: {
      labelKey: STATUS_KEY.completed,
      style: "bg-ink text-surface font-bold border-ink",
    },
    unlocked: {
      labelKey: STATUS_KEY.unlocked,
      style: "bg-surface-2 text-ink border-line font-semibold",
    },
    locked: {
      labelKey: STATUS_KEY.locked,
      style: "bg-surface-2 text-ink-3 border-line",
    },
  };

  const badge = statusBadges[node.status];
  const formulaKey = node.exampleFormulaKey;
  // Drills come back as an array via returnObjects (same pattern as training tips):
  // the key is relative, so the global `i18n.t` needs the explicit namespace prefix.
  const drillsRaw = (i18n.t as (key: string, options?: object) => unknown)(`skillTree:${node.drillsKey}`, {
    returnObjects: true,
    defaultValue: [],
  });
  const drillList: string[] = Array.isArray(drillsRaw) ? (drillsRaw as string[]) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={true}
        className={`max-w-xl bg-surface text-ink border-line rounded-xl p-6 shadow-2xl space-y-4 max-lg:max-h-[85vh] max-lg:overflow-y-auto max-lg:pb-safe ${TOUCH_FULL_BLEED}`}
      >
        {/* Header */}
        <DialogHeader className="space-y-1 text-left pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold tracking-wider text-ink-3 uppercase">
              {t(CATEGORY_KEY[node.category]).toUpperCase()} • {t("tierLabel")}{" "}
              {t(TIER_KEY[node.tier]).toUpperCase()}
            </span>
            <span
              className={cn(
                "px-2.5 py-0.5 text-xs border rounded-md transition-colors",
                badge.style
              )}
            >
              {t(badge.labelKey)}
            </span>
          </div>

          <DialogTitle className="text-xl font-bold text-ink tracking-tight flex items-center justify-between">
            <span>{t(node.titleKey)}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-3">
            {t(node.subtitleKey)}
          </DialogDescription>
        </DialogHeader>

        {/* Speedcubing Theory Explanation */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-ink" /> {t("theoryTitle")}
          </h4>
          <p className="text-xs text-ink/90 leading-relaxed bg-surface-2/30 p-3 rounded-lg border border-line/60">
            {t(node.theoryKey)}
          </p>
        </div>

        {/* Full Description */}
        <div className="text-xs text-ink-3 leading-relaxed px-1">
          {t(node.descriptionKey)}
        </div>

        {/* Model Formula / Insertion */}
        {formulaKey && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-ink" /> {t("formulaTitle")}
            </h4>
            <div className="p-3 bg-surface border border-line rounded-lg font-mono text-xs text-ink font-semibold text-center tracking-wide select-all shadow-inner">
              {t(formulaKey)}
            </div>
          </div>
        )}

        {/* Prerequisites */}
        {node.prerequisites.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              {t("prerequisites")}
            </h4>
            <div className="flex flex-wrap gap-2">
              {node.prerequisites.map((req) => {
                const prereqNode = NODE_BY_ID.get(req);
                return (
                  <span
                    key={req}
                    className="px-2.5 py-1 text-xs bg-surface-2/40 border border-line rounded-md text-ink-3 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-ink" /> {prereqNode ? t(prereqNode.titleKey) : req}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommended Drills */}
        {drillList.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-ink" /> {t("drillsTitle")}
            </h4>
            <ul className="space-y-1.5">
              {drillList.map((drill) => (
                <li
                  key={drill}
                  className="text-xs text-ink/90 flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-line"
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
                  <RotateCcw className="w-3.5 h-3.5" /> {t("markIncomplete")}
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" /> {t("markCompleted")}
                </>
              )}
            </Button>
          ) : (
            <span className="text-xs text-ink-3 italic flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> {t("lockedHint")}
            </span>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              {i18n.t("common:close")}
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
              {t("practiceSkill")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


