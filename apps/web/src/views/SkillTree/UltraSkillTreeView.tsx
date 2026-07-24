import { useState, useMemo } from "react";
import {
  Crosshair,
  Sparkles,
  Grid3x3,
  Flame,
  Eye,
  Layers,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillGraphCanvas } from "./SkillGraphCanvas";
import { SkillNodeModal } from "./SkillNodeModal";
import { SKILL_BRANCHES, ALL_SKILL_NODES, type SkillNode } from "./skillTreeData";

interface UltraSkillTreeViewProps {
  onNavigate?: (view: string) => void;
}

export function UltraSkillTreeView({ onNavigate }: UltraSkillTreeViewProps) {
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filteredNodes = useMemo(() => {
    if (filterCategory === "all") return ALL_SKILL_NODES;
    return ALL_SKILL_NODES.filter((n) => n.category === filterCategory);
  }, [filterCategory]);

  const handleSelectNode = (node: SkillNode) => {
    setSelectedNode(node);
    setModalOpen(true);
  };

  const handleStartDrill = (_node: SkillNode) => {
    onNavigate?.("training");
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-xl bg-card border border-border space-y-4 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary rounded">
                Speedcubing Skill Tree
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                CubeForge Progression v2.4
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-foreground mt-1 tracking-tight">
              Elite Progression Graph
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl mt-0.5">
              Explore and master advanced competitive speedcubing techniques: from XCross planning and edge control to COLL, ZBLL sets, and 3-Style commutators.
            </p>
          </div>

          {/* User Progress Card */}
          <div className="p-4 rounded-lg bg-muted/40 border border-border shrink-0 min-w-[220px] space-y-2 text-right">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1 text-primary">
                <Award className="w-3.5 h-3.5" /> Rank
              </span>
              <span className="text-foreground font-bold font-mono">Level 42</span>
            </div>
            <div className="text-sm font-bold text-foreground font-mono">
              Grandmaster Architect
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[71%] rounded-full" />
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              14,250 / 20,000 XP to Level 43
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="pt-3 flex flex-wrap gap-2 border-t border-border/60">
          <Button
            size="sm"
            variant={filterCategory === "all" ? "default" : "outline"}
            onClick={() => setFilterCategory("all")}
            className="text-xs gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" /> All Branches ({ALL_SKILL_NODES.length})
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "inspection" ? "default" : "outline"}
            onClick={() => setFilterCategory("inspection")}
            className="text-xs gap-1.5"
          >
            <Crosshair className="w-3.5 h-3.5 text-blue-500" /> Inspection & Cross
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "f2l" ? "default" : "outline"}
            onClick={() => setFilterCategory("f2l")}
            className="text-xs gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" /> Advanced F2L
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "edge-control" ? "default" : "outline"}
            onClick={() => setFilterCategory("edge-control")}
            className="text-xs gap-1.5"
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" /> Edge Control & Pre-LL
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "coll" ? "default" : "outline"}
            onClick={() => setFilterCategory("coll")}
            className="text-xs gap-1.5"
          >
            <Grid3x3 className="w-3.5 h-3.5 text-purple-500" /> COLL & Last Layer
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "zbll" ? "default" : "outline"}
            onClick={() => setFilterCategory("zbll")}
            className="text-xs gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-500" /> ZBLL & Master Sets
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "ergonomics" ? "default" : "outline"}
            onClick={() => setFilterCategory("ergonomics")}
            className="text-xs gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-500" /> Ergonomics & 3-Style
          </Button>
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
