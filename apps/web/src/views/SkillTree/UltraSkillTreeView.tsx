import { useState, useMemo, useEffect } from "react";
import { Search, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkillGraphCanvas } from "./SkillGraphCanvas";
import { SkillNodeModal } from "./SkillNodeModal";
import { ALL_SKILL_NODES, type SkillNode } from "./skillTreeData";

interface UltraSkillTreeViewProps {
  onNavigate?: (view: string) => void;
}

const CATEGORY_ITEMS = [
  { id: "all", label: "All Skills" },
  { id: "fundamentals", label: "Fundamentals" },
  { id: "cross", label: "Cross" },
  { id: "f2l", label: "F2L" },
  { id: "last-layer", label: "Last Layer" },
  { id: "lookahead", label: "Lookahead" },
  { id: "finger-tricks", label: "Finger Tricks" },
  { id: "inspection", label: "Inspection" },
  { id: "color-neutrality", label: "Color Neutrality" },
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
    // Default initial completed skills — first 3 fundamental nodes
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

      // Check if ALL prerequisites are satisfied
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

  const handleSelectNode = (node: SkillNode) => {
    setSelectedNodeId(node.id);
    setModalOpen(true);
  };

  const handleToggleComplete = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Verify node is accessible or already completed
    const targetNode = skillNodes.find((n) => n.id === nodeId);
    if (!targetNode || targetNode.status === "locked") return;

    setCompletedIds((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      } else {
        return [...prev, nodeId];
      }
    });
  };

  const handleStartDrill = (_node: SkillNode) => {
    onNavigate?.("training");
  };

  return (
    <div className="w-full max-w-7xl mx-auto h-full flex flex-col min-h-0 space-y-3">
      {/* Clean Toolbar Header */}
      <div className="p-3 sm:p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Description */}
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-foreground" />
              Speedcubing Skill Tree
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              A complete progression from absolute beginner to world-class elite — mastering every dimension of speedcubing.
            </p>
          </div>

          {/* Search Bar & Progress Ratio */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search technique..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/40 border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {/* Progress Badge */}
            <div className="px-3 py-1 rounded-lg bg-muted/50 border border-border text-xs flex items-center gap-1.5 shrink-0">
              <span className="text-muted-foreground font-medium">Completed:</span>
              <span className="text-foreground font-bold">
                {stats.completed}/{stats.total}
              </span>
              <span className="text-foreground font-mono font-semibold">({stats.percent}%)</span>
            </div>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="pt-2 flex items-center gap-1.5 overflow-x-auto border-t border-border/50 scrollbar-none">            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mr-1 shrink-0">
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
                className={`h-7 text-xs px-2.5 py-0 rounded-md border transition-all ${
                  isActive
                    ? "bg-foreground text-background font-semibold border-foreground shadow-sm"
                    : "bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }`}
              >
                {cat.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Interactive Node Graph Canvas */}
      <SkillGraphCanvas
        nodes={filteredNodes}
        onSelectNode={handleSelectNode}
        onToggleComplete={handleToggleComplete}
      />

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




