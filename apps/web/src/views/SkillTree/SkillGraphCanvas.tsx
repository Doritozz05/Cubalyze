import { useState, useRef, useMemo } from "react";
import {
  Lock,
  CheckCircle2,
  Flame,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SkillNode } from "./skillTreeData";

interface SkillGraphCanvasProps {
  nodes: SkillNode[];
  onSelectNode: (node: SkillNode) => void;
}

export function SkillGraphCanvas({ nodes, onSelectNode }: SkillGraphCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Quick lookup map for nodes
  const nodeMap = useMemo(() => {
    const map = new Map<string, SkillNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Generate SVG Bezier curve connectors between prerequisites and target nodes
  const connections = useMemo(() => {
    const lines: {
      id: string;
      from: SkillNode;
      to: SkillNode;
      isActive: boolean;
    }[] = [];

    nodes.forEach((target) => {
      target.prerequisites.forEach((reqId) => {
        const source = nodeMap.get(reqId);
        if (source) {
          const isActive =
            hoveredNodeId === source.id || hoveredNodeId === target.id;
          lines.push({
            id: `${source.id}->${target.id}`,
            from: source,
            to: target,
            isActive,
          });
        }
      });
    });

    return lines;
  }, [nodes, nodeMap, hoveredNodeId]);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    setDragStart({ eX: e.clientX, eY: e.clientY, pX: pan.x, pY: pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - (dragStart as any).eX;
    const dy = e.clientY - (dragStart as any).eY;
    setPan({ x: (dragStart as any).pX + dx, y: (dragStart as any).pY + dy });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(Math.max(prev + delta, 0.6), 1.6));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 40, y: 30 });
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={cn(
        "relative w-full h-[620px] overflow-hidden rounded-xl border border-border/70",
        "bg-background/95 select-none cursor-grab active:cursor-grabbing shadow-inner",
      )}
    >
      {/* Subtle Graph Grid Pattern Background */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-lg bg-card/80 border border-border/80 shadow-md backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => handleZoom(0.15)}
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => handleZoom(-0.15)}
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <div className="w-[1px] h-4 bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={resetView}
          title="Reset View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <span className="px-2 text-[10px] font-mono text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Canvas Viewport */}
      <div
        className="absolute inset-0 transition-transform duration-75 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG Edges Layer */}
        <svg className="absolute inset-0 w-[1600px] h-[1000px] pointer-events-none overflow-visible">
          <defs>
            <linearGradient id="edge-gradient-unlocked" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="edge-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {connections.map((c) => {
            // Node card center offset: width ~210px, height ~100px
            const x1 = c.from.x + 105;
            const y1 = c.from.y + 50;
            const x2 = c.to.x + 105;
            const y2 = c.to.y + 50;

            const dx = Math.abs(x2 - x1) * 0.5;
            const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            return (
              <g key={c.id}>
                {/* Background Shadow line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={c.isActive ? "rgba(99, 102, 241, 0.4)" : "var(--border)"}
                  strokeWidth={c.isActive ? 4 : 2}
                  strokeDasharray={c.to.status === "locked" ? "6,6" : undefined}
                />
                {/* Active Flow Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    c.isActive
                      ? "url(#edge-gradient-active)"
                      : c.from.status === "unlocked"
                      ? "url(#edge-gradient-unlocked)"
                      : "rgba(100, 116, 139, 0.25)"
                  }
                  strokeWidth={c.isActive ? 3 : 2}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        <div className="absolute inset-0 w-[1600px] h-[1000px]">
          {nodes.map((node) => {
            const isUnlocked = node.status === "unlocked";
            const isInProgress = node.status === "in-progress";
            const isHovered = hoveredNodeId === node.id;

            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                }}
                className={cn(
                  "absolute w-[210px] p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer group shadow-sm",
                  isUnlocked
                    ? "bg-card border-emerald-500/30 hover:border-emerald-500 hover:shadow-md hover:shadow-emerald-500/5"
                    : isInProgress
                    ? "bg-card border-amber-500/40 hover:border-amber-500 hover:shadow-md hover:shadow-amber-500/5"
                    : "bg-muted/30 border-border/60 opacity-80 hover:opacity-100 hover:border-border",
                  isHovered && "scale-[1.03] z-10",
                )}
              >
                {/* Top Badge & Status */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded border",
                      node.tier === "Master"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                        : node.tier === "Elite"
                        ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30"
                        : node.tier === "Pro"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        : node.tier === "Advanced"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                        : "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {node.tier}
                  </span>

                  <div className="flex items-center gap-1">
                    {isUnlocked ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isInProgress ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-mono text-amber-500 font-semibold">
                        <Flame className="w-3 h-3" /> {node.masteryPercentage}%
                      </span>
                    ) : (
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Node Title & Subtitle */}
                <div className="space-y-1 mb-3">
                  <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between leading-snug">
                    <span className="truncate">{node.title}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                  </h4>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                    {node.subtitle}
                  </p>
                </div>

                {/* Mastery Progress Line */}
                <div className="space-y-1 pt-1.5 border-t border-border/50">
                  <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                    <span>+{node.xpReward} XP</span>
                    <span>{node.masteryPercentage}%</span>
                  </div>
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isUnlocked
                          ? "bg-emerald-500"
                          : isInProgress
                          ? "bg-amber-500"
                          : "bg-muted-foreground/30",
                      )}
                      style={{ width: `${node.masteryPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info Hint */}
      <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2 text-[11px] text-muted-foreground bg-card/70 backdrop-blur-md px-2.5 py-1 rounded-md border border-border/60">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span>Drag to pan canvas • Scroll or click buttons to zoom • Click node to view speedcubing theory</span>
      </div>
    </div>
  );
}
