import { useState, useRef, useMemo, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowUpRight,
  CheckCircle2,
  Flame,
  Lock,
  Info,
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
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, pX: 0, pY: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

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

  // Smooth window drag listeners with RAF batching
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setPan({ x: dragStart.pX + dx, y: dragStart.pY + dy });
      });
    };

    const handleWindowMouseUp = () => {
      setIsDragging(false);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isDragging, dragStart]);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, pX: pan.x, pY: pan.y });
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
      className={cn(
        "relative w-full flex-1 min-h-0 overflow-hidden rounded-xl border border-border/80",
        "bg-background/95 select-none cursor-grab active:cursor-grabbing shadow-inner",
      )}
    >
      {/* Subtle Grid Pattern Background */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px] opacity-30 pointer-events-none" />

      {/* Floating Viewport Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-lg bg-card border border-border shadow-sm text-xs font-mono">
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
        <div className="w-px h-4 bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={resetView}
          title="Reset View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <span className="px-2 text-[10px] text-muted-foreground font-semibold">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Canvas Viewport (No CSS transition delay during drag + translate3d for GPU) */}
      <div
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
        }}
      >
        {/* SVG Tech Edges Layer */}
        <svg className="absolute inset-0 w-[1600px] h-[1000px] pointer-events-none overflow-visible">
          {connections.map((c) => {
            // Node center calculation based on compact node: width ~195px, height ~86px
            const x1 = c.from.x + 97.5;
            const y1 = c.from.y + 43;
            const x2 = c.to.x + 97.5;
            const y2 = c.to.y + 43;

            const dx = Math.abs(x2 - x1) * 0.5;
            const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            return (
              <g key={c.id}>
                {/* Outer halo / background line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={c.isActive ? "rgba(148, 163, 184, 0.4)" : "var(--border)"}
                  strokeWidth={c.isActive ? 3 : 1.5}
                  strokeDasharray={c.to.status === "locked" ? "4,4" : undefined}
                />
                {/* Active line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    c.isActive
                      ? "rgba(56, 189, 248, 0.9)"
                      : c.from.status === "unlocked"
                      ? "rgba(100, 116, 139, 0.5)"
                      : "rgba(100, 116, 139, 0.2)"
                  }
                  strokeWidth={c.isActive ? 2 : 1.25}
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
                  "absolute w-[195px] p-3 rounded-lg border text-left transition-all duration-200 cursor-pointer group shadow-sm bg-card",
                  isUnlocked
                    ? "border-border/80 hover:border-foreground/50 hover:shadow-md"
                    : isInProgress
                    ? "border-amber-500/50 hover:border-amber-500/80"
                    : "border-border/50 text-muted-foreground hover:border-border",
                  isHovered && "scale-[1.02] z-10 border-primary/60 shadow-md",
                )}
              >
                {/* Node Top Bar: Tier Tag & Status Icon */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {node.tier}
                  </span>

                  <div className="flex items-center gap-1">
                    {isUnlocked ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isInProgress ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500">
                        <Flame className="w-3 h-3" /> {node.masteryPercentage}%
                      </span>
                    ) : (
                      <Lock className="w-3 h-3 text-muted-foreground/60" />
                    )}
                  </div>
                </div>

                {/* Node Title & Subtitle */}
                <div className="space-y-0.5 mb-2.5">
                  <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between leading-snug">
                    <span className="truncate">{node.title}</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                  </h4>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 leading-tight">
                    {node.subtitle}
                  </p>
                </div>

                {/* Mastery Bar */}
                <div className="space-y-1 pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                    <span>+{node.xpReward} XP</span>
                    <span>{node.masteryPercentage}%</span>
                  </div>
                  <div className="w-full h-1 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isUnlocked
                          ? "bg-foreground"
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

      {/* Footer Info Legend */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 text-xs text-muted-foreground bg-card px-2.5 py-1 rounded-md border border-border shadow-sm">
        <Info className="w-3.5 h-3.5 text-primary shrink-0" />
        <span>Drag to pan canvas • Scroll to zoom • Click node for details</span>
      </div>
    </div>
  );
}


