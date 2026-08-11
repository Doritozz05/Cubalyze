import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { Search, SlidersHorizontal, Map, LayoutList, Check, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SkillGraphCanvas } from "./SkillGraphCanvas";
import { SkillNodeModal } from "./SkillNodeModal";
import { ALL_SKILL_NODES, CATEGORY_KEY, TIER_KEY, type SkillNode } from "./skillTreeData";
import { useSkillProgress } from "@/hooks/useSkillProgress";

interface UltraSkillTreeViewProps {
  onNavigate?: (view: string) => void;
}

const CATEGORY_ITEMS: { id: string; labelKey: ParseKeys<"skillTree"> }[] = [
  { id: "all", labelKey: "category.all" },
  { id: "fundamentals", labelKey: "category.fundamentals" },
  { id: "cross", labelKey: "category.cross" },
  { id: "f2l", labelKey: "category.f2l" },
  { id: "last-layer", labelKey: "category.last-layer" },
  { id: "lookahead", labelKey: "category.lookahead" },
  { id: "finger-tricks", labelKey: "category.finger-tricks" },
  { id: "inspection", labelKey: "category.inspection" },
  { id: "color-neutrality", labelKey: "category.color-neutrality" },
  { id: "hardware", labelKey: "category.hardware" },
  { id: "psychology", labelKey: "category.psychology" },
  { id: "training", labelKey: "category.training" },
  { id: "roux", labelKey: "category.roux" },
  { id: "zz", labelKey: "category.zz" },
  { id: "blindfold", labelKey: "category.blindfold" },
  { id: "fmc", labelKey: "category.fmc" },
  { id: "theory", labelKey: "category.theory" },
];

export function UltraSkillTreeView({ onNavigate }: UltraSkillTreeViewProps) {
  const { t } = useTranslation("skillTree");
  // View mode: 'graph' (interactive tree) or 'list' (compact card grid)
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  // Completed skill IDs — SQLite is the single source of truth (localStorage cache + migration as fallback).
  const { completedIds, setCompletedIds } = useSkillProgress();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Compute dynamic nodes with calculated statuses (completed, unlocked/accessible, locked)
  const skillNodes = useMemo(() => {
    const completedSet = new Set(completedIds);

    return ALL_SKILL_NODES.map((node) => {
      if (completedSet.has(node.id)) {
        return { ...node, status: "completed" as const, masteryPercentage: 100 };
      }

      const allPrereqsMet =
        node.prerequisites.length === 0 || node.prerequisites.every((req) => completedSet.has(req));

      if (allPrereqsMet) {
        return { ...node, status: "unlocked" as const, masteryPercentage: 0 };
      }

      return { ...node, status: "locked" as const, masteryPercentage: 0 };
    });
  }, [completedIds]);

  const selectedNode = useMemo(
    () => skillNodes.find((n) => n.id === selectedNodeId) || null,
    [skillNodes, selectedNodeId],
  );

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return skillNodes.filter((node) => {
      const matchesCategory =
        filterCategory === "all" || node.category === filterCategory;
      const matchesSearch =
        q === "" ||
        t(node.titleKey).toLowerCase().includes(q) ||
        t(node.subtitleKey).toLowerCase().includes(q) ||
        t(TIER_KEY[node.tier]).toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [skillNodes, filterCategory, searchQuery, t]);

  const stats = useMemo(() => {
    const completed = skillNodes.filter((n) => n.status === "completed").length;
    const accessible = skillNodes.filter((n) => n.status === "unlocked").length;
    const total = skillNodes.length;
    const percent = Math.round((completed / total) * 100);
    return { completed, accessible, total, percent };
  }, [skillNodes]);

  const handleSelectNode = useCallback((node: SkillNode) => {
    setSelectedNodeId(node.id);
    setModalOpen(true);
  }, []);

  const handleToggleComplete = useCallback((nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setCompletedIds((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      } else {
        return [...prev, nodeId];
      }
    });
  }, [setCompletedIds]);

  const handleStartDrill = (_node: SkillNode) => {
    onNavigate?.("training");
  };

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col overflow-hidden gap-3">
      {/* Clean Toolbar Header */}
      <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Description */}
          <div>
            <h1 className="text-lg font-bold text-ink tracking-tight">
              {t("title")}
            </h1>
            <p className="text-xs text-ink-3 mt-0.5">
              {t("subtitle")}
            </p>
          </div>

          {/* Search Bar, View Toggle & Progress Ratio */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-line bg-surface-2/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("graph")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                  viewMode === "graph"
                    ? "bg-surface text-ink font-semibold shadow-xs border border-line"
                    : "text-ink-3 hover:text-ink",
                )}
                title={t("viewTreeTitle")}
              >
                <Map className="size-3.5" />
                <span>{t("viewTree")}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                  viewMode === "list"
                    ? "bg-surface text-ink font-semibold shadow-xs border border-line"
                    : "text-ink-3 hover:text-ink",
                )}
                title={t("viewCardsTitle")}
              >
                <LayoutList className="size-3.5" />
                <span>{t("viewCards")}</span>
              </button>
            </div>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-surface-2/40 border-line/70 focus-visible:ring-1 focus-visible:ring-ink"
              />
            </div>

            {/* Progress Badge */}
            <div className="px-3 py-1 rounded-lg bg-surface-2/50 border border-line text-xs flex items-center gap-1.5 shrink-0">
              <span className="text-ink-3 font-medium">{t("completedLabel")}</span>
              <span className="text-ink font-bold">
                {stats.completed}/{stats.total}
              </span>
              <span className="text-ink font-mono font-semibold">({stats.percent}%)</span>
            </div>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="pt-2 flex items-center gap-1.5 overflow-x-auto border-t border-line/50 scrollbar-none">
          <span className="text-xs font-medium text-ink-3 flex items-center gap-1 mr-1 shrink-0">
            <SlidersHorizontal className="w-3 h-3" /> {t("branchLabel", { count: CATEGORY_ITEMS.length - 1 })}
          </span>
          {CATEGORY_ITEMS.map((cat) => {
            const isActive = filterCategory === cat.id;
            return (
              <Button
                key={cat.id}
                size="sm"
                variant="ghost"
                onClick={() => setFilterCategory(cat.id)}
                className={`h-7 text-xs px-2.5 py-0 rounded-md border transition-all cursor-pointer ${
                  isActive
                    ? "bg-ink text-surface font-semibold border-ink shadow-sm"
                    : "bg-surface-2/30 border-line/40 text-ink-3 hover:text-ink hover:bg-surface-2/70"
                }`}
              >
                {t(cat.labelKey)}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === "graph" ? (
        <div className="min-h-0 flex-1 w-full relative flex flex-col overflow-hidden">
          <SkillGraphCanvas
            nodes={filteredNodes}
            onSelectNode={handleSelectNode}
            onToggleComplete={handleToggleComplete}
          />
        </div>
      ) : (
        /* ── Fast Card Grid View (Ideal for mobile & quick browsing) ── */
        <div className="min-h-0 flex-1 w-full overflow-y-auto rounded-xl border border-line/80 bg-surface p-4 touch-pan-y overscroll-contain">
          {filteredNodes.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-ink-3">
              <Sparkles className="size-8 text-ink-3/40 mb-2" />
              <p className="text-sm font-medium">{t("noNodesFound")}</p>
              <p className="text-xs">{t("noNodesHint")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredNodes.map((node) => {
                const isCompleted = node.status === "completed";
                const isUnlocked = node.status === "unlocked";
                const isLocked = node.status === "locked";

                return (
                  <div
                    key={node.id}
                    onClick={() => handleSelectNode(node)}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer active:scale-[0.99]",
                      isCompleted && "border-ink/40 bg-surface-2/60 hover:border-ink",
                      isUnlocked && "border-line bg-surface hover:border-ink hover:shadow-xs",
                      isLocked && "border-line/60 bg-surface-2/20 opacity-70 hover:opacity-100",
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-ink-3 border border-line/50">
                          {t(TIER_KEY[node.tier])}
                        </span>
                        {!isLocked ? (
                          <button
                            type="button"
                            onClick={(e) => handleToggleComplete(node.id, e)}
                            className={cn(
                              "flex size-6 items-center justify-center rounded-full border transition-all cursor-pointer",
                              isCompleted
                                ? "border-ink bg-ink text-surface shadow-xs"
                                : "border-line bg-surface text-ink-3 hover:border-ink hover:text-ink",
                            )}
                            title={t(isCompleted ? "markUnlocked" : "markCompleted")}
                          >
                            <Check className="size-3.5 stroke-[2.5]" />
                          </button>
                        ) : (
                          <span className="flex size-6 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-3">
                            <Lock className="size-3" />
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-ink leading-tight">{t(node.titleKey)}</h3>
                      <p className="text-xs text-ink-3 mt-1 line-clamp-2">{t(node.subtitleKey)}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text.xs text-ink-3">
                      <span className="text-[0.68rem] capitalize font-medium">{t(CATEGORY_KEY[node.category])}</span>
                      <span className="text-[0.68rem] font-mono font-semibold text-ink">+{node.xpReward} XP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Skill Node Detail Modal */}
      <SkillNodeModal
        node={selectedNode}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onStartDrill={handleStartDrill}
        onToggleComplete={handleToggleComplete}
      />
    </div>
  );
}
