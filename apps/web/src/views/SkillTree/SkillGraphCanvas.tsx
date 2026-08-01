import { useState, useRef, useMemo, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  Info,
  Check,
  Eye,
  EyeOff,
  Box,
  Key,
  Layers,
  Grid,
  Grid3x3,
  Zap,
  Snowflake,
  Sparkles,
  Cpu,
  Shield,
  ShieldCheck,
  Wand2,
  Crown,
  Activity,
  Palette,
  Glasses,
  BookOpen,
  Crosshair,
  Pyramid,
  Star,
  Trophy,
  Repeat,
  ArrowDown,
  Gauge,
  Timer,
  Compass,
  GitMerge,
  Workflow,
  GitBranch,
  Code2,
  ScanEye,
  ArrowUpLeft,
  Swords,
  RotateCcw,
  ArrowRightLeft,
  Music,
  Infinity as InfinityIcon,
  Target,
  Play,
  Brain,
  Hand,
  MoveRight,
  ChevronsRight,
  ChevronsDown,
  AlignCenter,
  Move,
  MousePointerClick,
  Search,
  BrainCircuit,
  Scan,
  GitCompare,
  Map as MapIcon,
  Circle,
  CircleDot,
  Globe,
  Wrench,
  Droplets,
  Settings2,
  Magnet,
  PackageSearch,
  SlidersHorizontal,
  RotateCw,
  Heart,
  PlayCircle,
  Flag,
  ClipboardList,
  Microscope,
  BarChart3,
  Calendar,
  TrendingUp,
  Square,
  LayoutTemplate,
  Triangle,
  ArrowUpDown,
  MoveVertical,
  Move3d,
  LayoutList,
  Shuffle,
  Image,
  Music2,
  Dice6,
  Award,
  AlignStartVertical,
  Gem,
  Calculator,
  Sigma,
  Atom,
  Dna,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsTouch } from "@/hooks/use-mobile";
import type { SkillNode } from "./skillTreeData";

interface SkillGraphCanvasProps {
  nodes: SkillNode[];
  onSelectNode: (node: SkillNode) => void;
  onToggleComplete?: (nodeId: string, e: React.MouseEvent) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  EyeOff,
  Box,
  Key,
  Layers,
  Grid,
  Grid3x3,
  Zap,
  Snowflake,
  Sparkles,
  Cpu,
  Shield,
  ShieldCheck,
  Wand2,
  Crown,
  Activity,
  Palette,
  Glasses,
  BookOpen,
  Crosshair,
  Pyramid,
  Star,
  Trophy,
  Repeat,
  ArrowDown,
  Gauge,
  Timer,
  Compass,
  GitMerge,
  Workflow,
  GitBranch,
  Code2,
  ScanEye,
  ArrowUpLeft,
  Swords,
  RotateCcw,
  ArrowRightLeft,
  Music,
  Infinity: InfinityIcon,
  Target,
  Play,
  Brain,
  Hand,
  MoveRight,
  ChevronsRight,
  ChevronsDown,
  AlignCenter,
  Move,
  MousePointerClick,
  Search,
  BrainCircuit,
  Scan,
  GitCompare,
  Map: MapIcon,
  Circle,
  CircleDot,
  Globe,
  Wrench,
  Droplets,
  Settings2,
  Magnet,
  PackageSearch,
  SlidersHorizontal,
  RotateCw,
  Heart,
  PlayCircle,
  Flag,
  ClipboardList,
  Microscope,
  BarChart3,
  Calendar,
  TrendingUp,
  Square,
  LayoutTemplate,
  Triangle,
  ArrowUpDown,
  MoveVertical,
  Move3d,
  LayoutList,
  Shuffle,
  Image,
  Music2,
  Dice6,
  Award,
  AlignStartVertical,
  Gem,
  Calculator,
  Sigma,
  Atom,
  Dna,
  Lightbulb,
};

export function SkillGraphCanvas({
  nodes,
  onSelectNode,
  onToggleComplete,
}: SkillGraphCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, pX: 0, pY: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const isTouch = useIsTouch();
  const didInitTouchView = useRef(false);

  // Quick lookup map for nodes
  const nodeMap = useMemo(() => {
    const map = new Map<string, SkillNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Generate SVG Bezier curves between parent and child nodes
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

  // Smooth window mouse drag listeners with RAF batching
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

  // Touch Gesture Handling: 1 & 2-finger drag + 2-finger pinch zoom without page scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartInfo: {
      pX: number;
      pY: number;
      startX: number;
      startY: number;
      startDist?: number;
      startZoom?: number;
    } | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;

      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartInfo = {
          pX: pan.x,
          pY: pan.y,
          startX: t.clientX,
          startY: t.clientY,
        };
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        touchStartInfo = {
          pX: pan.x,
          pY: pan.y,
          startX: midX,
          startY: midY,
          startDist: dist,
          startZoom: zoom,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartInfo) return;
      // Prevent browser page scrolling completely during canvas gesture!
      e.preventDefault();

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        if (!touchStartInfo) return;

        if (e.touches.length === 1) {
          const t = e.touches[0];
          const dx = t.clientX - touchStartInfo.startX;
          const dy = t.clientY - touchStartInfo.startY;
          setPan({ x: touchStartInfo.pX + dx, y: touchStartInfo.pY + dy });
        } else if (e.touches.length === 2 && touchStartInfo.startDist && touchStartInfo.startZoom) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const midX = (t1.clientX + t2.clientX) / 2;
          const midY = (t1.clientY + t2.clientY) / 2;
          const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

          const dx = midX - touchStartInfo.startX;
          const dy = midY - touchStartInfo.startY;
          setPan({ x: touchStartInfo.pX + dx, y: touchStartInfo.pY + dy });

          // Pinch Zoom
          const scale = currentDist / touchStartInfo.startDist;
          const newZoom = Math.min(Math.max(touchStartInfo.startZoom * scale, 0.6), 1.6);
          setZoom(newZoom);
        }
      });
    };

    const handleTouchEnd = () => {
      touchStartInfo = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [pan.x, pan.y, zoom]);

  // Touch: start at 0.6x zoom, centered on the root node (mount-only)
  useEffect(() => {
    if (!isTouch || didInitTouchView.current) return;
    const container = containerRef.current;
    const root = nodes.find((n) => n.prerequisites.length === 0) ?? nodes[0];
    if (!container || !root) return;
    didInitTouchView.current = true;
    const scale = 0.6;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    setZoom(scale);
    setPan({
      x: cw / 2 - (root.x + 34) * scale,
      y: ch / 2 - (root.y + 34) * scale,
    });
  }, [isTouch, nodes]);

  // Mouse Pan controls
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
    setPan({ x: 50, y: 50 });
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className={cn(
        "relative w-full flex-1 min-h-130 overflow-hidden rounded-xl border border-line/80 touch-none",
        "bg-canvas/95 select-none cursor-grab active:cursor-grabbing shadow-inner",
      )}
    >
      {/* Subtle Grid Pattern Background */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-size-[24px_24px] opacity-35 pointer-events-none" />

      {/* Floating Viewport Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-lg bg-surface/90 backdrop-blur-sm border border-line shadow-sm text-xs font-mono max-lg:top-auto max-lg:bottom-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-ink-3 hover:text-ink max-lg:h-9 max-lg:w-9"
          onClick={() => handleZoom(0.15)}
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-ink-3 hover:text-ink max-lg:h-9 max-lg:w-9"
          onClick={() => handleZoom(-0.15)}
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <div className="w-px h-4 bg-line" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-ink-3 hover:text-ink max-lg:h-9 max-lg:w-9"
          onClick={resetView}
          title="Reset view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <span className="px-2 text-[0.62rem] text-ink-3 font-semibold">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Canvas Viewport */}
      <div
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
        }}
      >
        {/* SVG Tree Bezier Connectors Layer */}
        <svg className="absolute inset-0 w-[7200px] h-[3400px] pointer-events-none overflow-visible">
          {connections.map((c) => {
            const x1 = c.from.x + 34;
            const y1 = c.from.y + 34;
            const x2 = c.to.x + 34;
            const y2 = c.to.y + 34;

            const dx = Math.abs(x2 - x1) * 0.5;
            const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            const isUnlockedLink =
              c.from.status === "completed" || c.from.status === "unlocked";

            return (
              <g key={c.id}>
                {c.isActive && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="var(--ink)"
                    strokeWidth={4}
                    strokeOpacity={0.15}
                    strokeLinecap="round"
                  />
                )}

                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    c.isActive
                      ? "var(--ink)"
                      : isUnlockedLink
                      ? "rgba(148, 163, 184, 0.7)"
                      : "rgba(100, 116, 139, 0.25)"
                  }
                  strokeWidth={c.isActive ? 2.5 : isUnlockedLink ? 1.75 : 1.25}
                  strokeDasharray={c.to.status === "locked" ? "4,4" : undefined}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>

        {/* Round Nodes Layer */}
        <div className="absolute inset-0 w-[7200px] h-[3400px]">
          {nodes.map((node) => {
            const isCompleted = node.status === "completed";
            const isUnlocked = node.status === "unlocked";
            const isLocked = node.status === "locked";
            const isHovered = hoveredNodeId === node.id;

            const NodeIcon =
              (node.iconName && ICON_MAP[node.iconName]) || Sparkles;

            return (
              <div
                key={node.id}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className="absolute flex flex-col items-center group cursor-pointer"
              >
                {/* Round Skill Circle Node */}
                <div
                  onClick={() => onSelectNode(node)}
                  className={cn(
                    "relative w-17 h-17 rounded-full flex items-center justify-center transition-all duration-300 shadow-md",
                    // 1. ACCESIBLE (unlocked, not completed): Solid background, dark text/icon, crisp border
                    isUnlocked &&
                      "bg-surface text-ink border-2 border-ink hover:border-ink hover:scale-110 hover:shadow-lg",
                    // 2. COMPLETADO (completed): Solid high contrast style
                    isCompleted &&
                      "bg-ink text-surface font-bold border-2 border-ink shadow-lg group-hover:scale-110",
                    // 3. INACCESIBLE (locked): Solid muted background with lock icon
                    isLocked &&
                      "bg-surface-2 border-2 border-line text-ink-3 group-hover:border-ink group-hover:scale-105",
                    isHovered && "z-10 ring-4 ring-ink",
                  )}
                >
                  {/* Icon */}
                  <NodeIcon className="w-7 h-7 stroke-2" />

                  {/* Status Indicator */}
                  {isCompleted && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-canvas border-2 border-ink text-ink flex items-center justify-center text-[0.62rem] font-bold shadow-sm">
                      <Check className="w-3 h-3 stroke-3" />
                    </div>
                  )}

                  {isLocked && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-surface-2 border border-line text-ink-3 flex items-center justify-center text-[0.62rem]">
                      <Lock className="w-3 h-3" />
                    </div>
                  )}

                  {/* Hover Quick Toggle Action for accessible nodes (desktop only; touch uses overlay checks below) */}
                  {onToggleComplete && !isLocked && (
                    <button
                      onClick={(e) => onToggleComplete(node.id, e)}
                      title={isCompleted ? "Mark as accessible" : "Mark as completed"}
                      className={cn(
                        "absolute -bottom-1 -right-1 w-5.5 h-5.5 rounded-full bg-surface border border-ink flex items-center justify-center text-ink opacity-0 group-hover:opacity-100 transition-opacity hover:bg-ink hover:text-surface shadow-md",
                        "max-lg:hidden",
                      )}
                    >
                      <Check className="w-3 h-3 stroke-3" />
                    </button>
                  )}
                </div>

                {/* Clean Label Under Node */}
                <div className="mt-2 text-center w-36 space-y-0.5 pointer-events-none">
                  <h4
                    className={cn(
                      "text-xs font-bold tracking-tight leading-tight line-clamp-2 transition-colors",
                      isCompleted
                        ? "text-ink font-semibold"
                        : isUnlocked
                        ? "text-ink group-hover:text-ink"
                        : "text-ink-3",
                    )}
                  >
                    {node.title}
                  </h4>
                  <span className="text-[0.62rem] uppercase tracking-wider font-semibold text-ink-3 block">
                    {node.tier}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Touch: always-visible ≥36px complete checks, rendered OUTSIDE the scaled canvas so real size stays 36px */}
      {isTouch && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {nodes.map((node) => {
            if (!onToggleComplete || node.status === "locked") return null;
            const isCompleted = node.status === "completed";
            return (
              <button
                key={`touch-check-${node.id}`}
                onClick={(e) => onToggleComplete(node.id, e)}
                title={isCompleted ? "Mark as accessible" : "Mark as completed"}
                aria-label={isCompleted ? "Mark as accessible" : "Mark as completed"}
                style={{
                  // 61 = node corner (68) + 4px offset − half of the original 22px button
                  left: pan.x + (node.x + 61) * zoom,
                  top: pan.y + (node.y + 61) * zoom,
                }}
                className="pointer-events-auto absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink bg-surface text-ink shadow-md transition-colors active:scale-90 hover:bg-ink hover:text-surface"
              >
                <Check className="size-4 stroke-[2.5]" />
              </button>
            );
          })}
        </div>
      )}

      {/* Footer Info Legend */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 text-xs text-ink-3 bg-surface/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-line shadow-sm max-lg:hidden">
        <Info className="w-3.5 h-3.5 text-ink shrink-0" />
        <span>Click an accessible node for full explanations or to mark as completed</span>
      </div>
    </div>
  );
}




