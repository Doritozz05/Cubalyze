import { useState, useMemo } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkillGraphCanvas } from "./SkillGraphCanvas";
import { SkillNodeModal } from "./SkillNodeModal";
import { ALL_SKILL_NODES, type SkillNode } from "./skillTreeData";

interface UltraSkillTreeViewProps {
  onNavigate?: (view: string) => void;
}

const CATEGORY_ITEMS = [
  { id: "all", label: "All Nodes" },
  { id: "inspection", label: "Inspection & Cross" },
  { id: "f2l", label: "Advanced F2L" },
  { id: "edge-control", label: "Edge Control" },
  { id: "coll", label: "COLL & LL" },
  { id: "zbll", label: "ZBLL Sets" },
  { id: "ergonomics", label: "Ergonomics & 3-Style" },
];

export function UltraSkillTreeView({ onNavigate }: UltraSkillTreeViewProps) {
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredNodes = useMemo(() => {
    return ALL_SKILL_NODES.filter((node) => {
      const matchesCategory =
        filterCategory === "all" || node.category === filterCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.tier.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [filterCategory, searchQuery]);

  const stats = useMemo(() => {
    const unlocked = ALL_SKILL_NODES.filter((n) => n.status === "unlocked").length;
    const inProgress = ALL_SKILL_NODES.filter((n) => n.status === "in-progress").length;
    const total = ALL_SKILL_NODES.length;
    const percent = Math.round((unlocked / total) * 100);
    return { unlocked, inProgress, total, percent };
  }, []);

  const handleSelectNode = (node: SkillNode) => {
    setSelectedNode(node);
    setModalOpen(true);
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
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Speedcubing Skills
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Technique progression graph: from inspection and F2L to COLL, ZBLL sets, and 3-Style.
            </p>
          </div>

          {/* Search Bar & Progress Ratio */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search technique or tier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/40 border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {/* Progress Badge */}
            <div className="px-3 py-1 rounded-md bg-muted/50 border border-border text-xs flex items-center gap-1.5 shrink-0">
              <span className="text-muted-foreground font-medium">Progress:</span>
              <span className="text-foreground font-bold">
                {stats.unlocked}/{stats.total}
              </span>
              <span className="text-emerald-500 font-semibold">({stats.percent}%)</span>
            </div>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="pt-2 flex items-center gap-1.5 overflow-x-auto border-t border-border/50 scrollbar-none">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mr-1 shrink-0">
            <SlidersHorizontal className="w-3 h-3" /> Branch:
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
      />

      {/* Skill Node Detail Modal */}
      <SkillNodeModal
        node={selectedNode}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onStartDrill={handleStartDrill}
      />
    </div>
  );
}


