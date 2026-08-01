import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, Map, LayoutList, Check, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useIsTouch } from "@/hooks/use-mobile";
import { SkillGraphCanvas } from "./SkillGraphCanvas";
import { SkillNodeModal } from "./SkillNodeModal";
import { ALL_SKILL_NODES, type SkillNode } from "./skillTreeData";

interface UltraSkillTreeViewProps {
  onNavigate?: (view: string) => void;
}

const CATEGORY_ITEMS = [
  { id: "all", label: "All skills" },
  { id: "fundamentals", label: "Fundamentals" },
  { id: "cross", label: "Cross" },
  { id: "f2l", label: "F2L" },
  { id: "last-layer", label: "Last layer" },
  { id: "lookahead", label: "Lookahead" },
  { id: "finger-tricks", label: "Finger tricks" },
  { id: "inspection", label: "Inspection" },
  { id: "color-neutrality", label: "Color neutrality" },
  { id: "hardware", label: "Hardware" },
  { id: "psychology", label: "Psychology" },
  { id: "training", label: "Training" },
  { id: "roux", label: "Roux" },
  { id: "zz", label: "ZZ" },
  { id: "blindfold", label: "Blindfold" },
  { id: "fmc", label: "FMC" },
  { id: "theory", label: "Theory" },
];

const LOCAL_STORAGE_KEY = "cubeforge_completed_skills_v2";

export function UltraSkillTreeView({ onNavigate }: UltraSkillTreeViewProps) {
  const isTouch = useIsTouch();

  // View mode: 'graph' (interactive tree) or 'list' (compact card grid)
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  // Set of completed skill IDs
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return ["cube-anatomy", "standard-notation", "first-cross"];
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(completedIds));
    } catch {
      // Ignore
    }
  }, [completedIds]);

  // Compute dynamic nodes with calculated statuses (completed, unlocked/accessible, locked)
  const skillNodes = useMemo(() => {
    const completedSet = new Set(completedIds);

    return ALL_SKILL_NODES.map((node) => {
      if (completedSet.has(node.id)) {
        return { ...node, status: "completed" as const, masteryPercentage: 100 };
      }

      const allPrereqsMet =
        node.prerequisites.length === 0 ||
        node.prerequisites.every((req) => completedSet.has(req));

      if (allPrereqsMet) {
        return { ...node, status: "unlocked" as const, masteryPercentage: 0 };
      }

      return { ...node, status: "locked" as const, masteryPercentage: 0 };
    });
  }, [completedIds]);

  const selectedNode = useMemo(() => {
    return skillNodes.find((n) => n.id === selectedNodeId) || null;
  }, [skillNodes, selectedNodeId]);

  const filteredNodes = useMemo(() => {
    return skillNodes.filter((node) => {
      const matchesCategory =
        filterCategory === "all" || node.category === filterCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.tier.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [skillNodes, filterCategory, searchQuery]);

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
  }, []);

  const handleStartDrill = (_node: SkillNode) => {
    onNavigate?.("training");
  };

  return (
    <div className="w-full max-w-7xl mx-auto h-full flex flex-col min-h-0 space-y-3">
      {/* Clean Toolbar Header */}
      <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Description */}
          <div>
            <h1 className="text-lg font-bold text-ink tracking-tight">
              Speedcubing Skill Tree
            </h1>
            <p className="text-xs text-ink-3 mt-0.5">
              A complete progression from absolute beginner to world-class elite — mastering every dimension of speedcubing.
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
                title="Graph view"
              >
                <Map className="size-3.5" />
                <span>Tree</span>
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
                title="List / Grid view"
              >
                <LayoutList className="size-3.5" />
                <span>Cards</span>
              </button>
            </div>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input
                type="text"
                placeholder="Search technique..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-surface-2/40 border-line/70 focus-visible:ring-1 focus-visible:ring-ink"
              />
            </div>

            {/* Progress Badge */}
            <div className="px-3 py-1 rounded-lg bg-surface-2/50 border border-line text-xs flex items-center gap-1.5 shrink-0">
              <span className="text-ink-3 font-medium">Completed:</span>
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
            <SlidersHorizontal className="w-3 h-3" /> Branch ({CATEGORY_ITEMS.length - 1}):
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
                {cat.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === "graph" ? (
        <SkillGraphCanvas
          nodes={filteredNodes}
          onSelectNode={handleSelectNode}
          onToggleComplete={handleToggleComplete}
        />
      ) : (
        /* ── Fast Card Grid View (Ideal for mobile & quick browsing) ── */
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-line/80 bg-surface p-4">
          {filteredNodes.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-ink-3">
              <Sparkles className="size-8 text-ink-3/40 mb-2" />
              <p className="text-sm font-medium">No skill nodes found</p>
              <p className="text-xs">Try selecting a different branch or search query.</p>
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
                          {node.tier}
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
                            title={isCompleted ? "Mark as unlocked" : "Mark as completed"}
                          >
                            <Check className="size-3.5 stroke-[2.5]" />
                          </button>
                        ) : (
                          <span className="flex size-6 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-3">
                            <Lock className="size-3" />
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-ink leading-tight">{node.title}</h3>
                      <p className="text-xs text-ink-3 mt-1 line-clamp-2">{node.subtitle}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text.xs text-ink-3">
                      <span className="text-[0.68rem] capitalize font-medium">{node.category}</span>
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
