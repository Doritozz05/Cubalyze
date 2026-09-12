"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
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
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsTouch } from "@/hooks/use-mobile";
import { TIER_KEY, type SkillNode } from "./skillTreeData";

interface SkillGraphCanvasProps {
  nodes: SkillNode[];
  onSelectNode: (node: SkillNode) => void;
  onToggleComplete?: (nodeId: string, e: React.MouseEvent) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye, EyeOff, Box, Key, Layers, Grid, Grid3x3, Zap, Snowflake, Sparkles,
  Cpu, Shield, ShieldCheck, Wand2, Crown, Activity, Palette, Glasses, BookOpen,
  Crosshair, Pyramid, Star, Trophy, Repeat, ArrowDown, Gauge, Timer, Compass,
  GitMerge, Workflow, GitBranch, Code2, ScanEye, ArrowUpLeft, Swords, RotateCcw,
  ArrowRightLeft, Music, Infinity: InfinityIcon, Target, Play, Brain, Hand,
  MoveRight, ChevronsRight, ChevronsDown, AlignCenter, Move, MousePointerClick,
  Search, BrainCircuit, Scan, GitCompare, Map: MapIcon, Circle, CircleDot,
  Globe, Wrench, Droplets, Settings2, Magnet, PackageSearch, SlidersHorizontal,
  RotateCw, Heart, PlayCircle, Flag, ClipboardList, Microscope, BarChart3,
  Calendar, TrendingUp, Square, LayoutTemplate, Triangle, ArrowUpDown,
  MoveVertical, Move3d, LayoutList, Shuffle, Image, Music2, Dice6, Award,
  AlignStartVertical, Gem, Calculator, Sigma, Atom, Dna, Lightbulb,
};

// ── Memoized Single Node Item ───────────────────────────────────────────────

interface SkillNodeItemProps {
  node: SkillNode;
  isHovered: boolean;
  onMouseEnter: (id: string) => void;
  onMouseLeave: () => void;
  onSelectNode: (node: SkillNode) => void;
  onToggleComplete?: (nodeId: string, e: React.MouseEvent) => void;
}

const SkillNodeItem = React.memo(function SkillNodeItem({
  node,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onSelectNode,
  onToggleComplete,
}: SkillNodeItemProps) {
  const { t } = useTranslation("skillTree");
  const isCompleted = node.status === "completed";
  const isUnlocked = node.status === "unlocked";
  const isLocked = node.status === "locked";

  const NodeIcon = (node.iconName && ICON_MAP[node.iconName]) || Sparkles;

  const handleMouseEnter = useCallback(() => onMouseEnter(node.id), [onMouseEnter, node.id]);
  const handleSelect = useCallback(() => onSelectNode(node), [onSelectNode, node]);
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleComplete?.(node.id, e);
    },
    [onToggleComplete, node.id],
  );

  return (
    <div
      style={{ left: `${node.x}px`, top: `${node.y}px` }}
      // The wrapper is hit-transparent; only the visible circle is a target.
      // Its box is as wide as the label (w-36) and includes it, so otherwise the
      // empty space AROUND a node — exactly where a connector line is grabbed —
      // counted as hover and re-rendered the whole canvas on every pan move.
      className="absolute flex flex-col items-center pointer-events-none"
    >
      {/* Round Skill Circle Node */}
      <div
        onClick={handleSelect}
        // Hover is bound to the visible circle, not the wrapper, so the highlight
        // matches exactly what the pointer is over (and `group`/`group-hover`
        // are no longer needed to fake that boundary).
        onMouseEnter={handleMouseEnter}
        onMouseLeave={onMouseLeave}
        className={cn(
          "relative w-17 h-17 rounded-full flex items-center justify-center transition-all duration-200 shadow-md pointer-events-auto cursor-pointer",
          isUnlocked && "bg-surface text-ink border-2 border-ink hover:border-ink hover:scale-110 hover:shadow-lg",
          isCompleted && "bg-ink text-surface font-bold border-2 border-ink shadow-lg hover:scale-110",
          isLocked && "bg-surface-2 border-2 border-line text-ink-3 hover:border-ink hover:scale-105",
          isHovered && "z-10 ring-4 ring-ink",
        )}
      >
        <NodeIcon className="w-7 h-7 stroke-2" />

        {/* Status / Toggle Badge */}
        {!isLocked && onToggleComplete ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleToggle}
                aria-label={t(isCompleted ? "markAccessible" : "markCompleted")}
                className={cn(
                  "absolute -top-1 -right-1 z-20 flex size-6 items-center justify-center rounded-full border transition-all active:scale-95 shadow-xs touch-manipulation cursor-pointer",
                  isCompleted
                    ? "border-ink bg-ink text-surface shadow-sm"
                    : "border-line bg-surface text-ink-3 hover:border-ink hover:text-ink hover:bg-surface-2",
                )}
              >
                <Check className={cn("size-3.5 stroke-[2.5]", isCompleted ? "opacity-100" : "opacity-40")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t(isCompleted ? "markAccessible" : "markCompleted")}
            </TooltipContent>
          </Tooltip>
        ) : isCompleted ? (
          <div className="absolute -top-1 -right-1 z-20 flex size-5.5 items-center justify-center rounded-full border border-ink bg-ink text-surface shadow-xs">
            <Check className="size-3 stroke-[2.5]" />
          </div>
        ) : isLocked ? (
          <div className="absolute -top-1 -right-1 z-20 flex size-5.5 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-3">
            <Lock className="size-3" />
          </div>
        ) : null}
      </div>

      {/* Clean Label Under Node */}
      <div className="mt-2 text-center w-36 space-y-0.5 pointer-events-none">
        <h4
          className={cn(
            "text-xs font-bold tracking-tight leading-tight line-clamp-2 transition-colors",
            isCompleted
              ? "text-ink font-semibold"
              : isUnlocked
              ? "text-ink"
              : "text-ink-3",
          )}
        >
          {t(node.titleKey)}
        </h4>
        <span className="text-[0.62rem] uppercase tracking-wider font-semibold text-ink-3 block">
          {t(TIER_KEY[node.tier])}
        </span>
      </div>
    </div>
  );
});

// ── Memoized Edge ──────────────────────────────────────────────────────────

interface SkillEdgeProps {
  pathD: string;
  isActive: boolean;
  isUnlockedLink: boolean;
  dashed: boolean;
}

/**
 * One prerequisite connector. Memoised on primitives so a hover (which only
 * changes `isActive` on the few edges touching the hovered node) leaves the
 * other ~150 paths untouched in the DOM — the difference between a smooth
 * hover and a full-tree re-render per pointer move.
 */
const SkillEdge = React.memo(function SkillEdge({
  pathD,
  isActive,
  isUnlockedLink,
  dashed,
}: SkillEdgeProps) {
  return (
    <g>
      {isActive && (
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
          isActive
            ? "var(--ink)"
            : isUnlockedLink
            ? "rgba(148, 163, 184, 0.7)"
            : "rgba(100, 116, 139, 0.25)"
        }
        strokeWidth={isActive ? 2.5 : isUnlockedLink ? 1.75 : 1.25}
        strokeDasharray={dashed ? "4,4" : undefined}
      />
    </g>
  );
});

// ── Main Canvas Component ──────────────────────────────────────────────────

export function SkillGraphCanvas({
  nodes,
  onSelectNode,
  onToggleComplete,
}: SkillGraphCanvasProps) {
  const { t } = useTranslation("skillTree");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);

  // Mutable refs for high-fps drag without React re-renders
  const panRef = useRef({ x: 50, y: 50 });
  const zoomRef = useRef(1);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, pX: 50, pY: 50 });
  const rafIdRef = useRef<number | null>(null);
  // Set once a pan has actually moved the pointer. Read by the node click
  // handler (an onClick still fires after a drag that began on a node) and
  // reset by the next mousedown.
  const dragMovedRef = useRef(false);

  const isTouch = useIsTouch();
  const didInitView = useRef(false);

  // Keep refs synced with React state
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Apply transform directly to GPU DOM layer
  const applyTransform = useCallback((x: number, y: number, z: number) => {
    if (transformRef.current) {
      transformRef.current.style.transform = `translate3d(${x}px, ${y}px, 0px) scale(${z})`;
    }
  }, []);

  /**
   * One transform write per frame, at most. Re-scheduling a frame on every
   * input sample meant a 1 kHz mouse cancelled and re-queued a rAF a thousand
   * times a second for a single visual update; the ref now holds the *pending*
   * frame (or null) and the callback reads the latest refs, so a burst of
   * samples still costs exactly one style write.
   */
  const scheduleTransform = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      applyTransform(panRef.current.x, panRef.current.y, zoomRef.current);
    });
  }, [applyTransform]);

  /**
   * Pan lifecycle. Besides the refs, `beginPan` puts the canvas in
   * `is-panning`, which makes the node subtree hit-transparent for the duration
   * (see the `.skill-canvas.is-panning` rule in index.css). While the layer
   * itself is being dragged nothing underneath has to react, and leaving 130
   * nodes hit-testable made the browser re-resolve the hover chain on every
   * pointer sample: a pan that started over a node — or over a connector —
   * crawled, while the same pan from the bare canvas stayed smooth.
   */
  const beginPan = useCallback(() => {
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    containerRef.current?.classList.add("is-panning");
  }, []);

  const endPan = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    applyTransform(panRef.current.x, panRef.current.y, zoomRef.current);
    containerRef.current?.classList.remove("is-panning");
  }, [applyTransform]);

  // Set zoom with sync
  const updateZoom = useCallback(
    (newZoom: number) => {
      const z = Math.min(Math.max(newZoom, 0.5), 1.8);
      setZoom(z);
      zoomRef.current = z;
      applyTransform(panRef.current.x, panRef.current.y, z);
    },
    [applyTransform],
  );

  const updatePan = useCallback(
    (newPan: { x: number; y: number }) => {
      setPan(newPan);
      panRef.current = newPan;
      applyTransform(newPan.x, newPan.y, zoomRef.current);
    },
    [applyTransform],
  );

  // Quick lookup map for nodes
  const nodeMap = useMemo(() => {
    const map = new Map<string, SkillNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Connections memoized
  const connections = useMemo(() => {
    const lines: {
      id: string;
      from: SkillNode;
      to: SkillNode;
    }[] = [];

    nodes.forEach((target) => {
      target.prerequisites.forEach((reqId) => {
        const source = nodeMap.get(reqId);
        if (source) {
          lines.push({
            id: `${source.id}->${target.id}`,
            from: source,
            to: target,
          });
        }
      });
    });

    return lines;
    // Deliberately NOT keyed on `hoveredNodeId`: the highlight is resolved at
    // render time so a hover only re-styles the handful of affected edges
    // (each `SkillEdge` is memoised) instead of rebuilding the whole list.
  }, [nodes, nodeMap]);

  // Handle node hover. Ignored while panning: the whole tree re-renders on a
  // hover change (146 nodes, 153 edges), which fights the rAF transform writes
  // and makes a pan that began over a node stutter. Hover is a resting-state
  // affordance, so it simply has no meaning mid-drag.
  const handleMouseEnterNode = useCallback((id: string) => {
    if (isDraggingRef.current) return;
    setHoveredNodeId(id);
  }, []);

  const handleMouseLeaveNode = useCallback(() => {
    if (isDraggingRef.current) return;
    setHoveredNodeId(null);
  }, []);

  // A pan that began on a node still ends with a `click` on that node — the
  // layer moves with the pointer, so the circle stays under the cursor. Without
  // this guard, panning the tree would open a node modal on release.
  const handleSelectNode = useCallback(
    (node: SkillNode) => {
      if (dragMovedRef.current) return;
      onSelectNode(node);
    },
    [onSelectNode],
  );

  // ── Mouse Drag (Hardware-Accelerated RAF) ────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Primary button only, and never from an interactive control (the node's
    // completion toggle).
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    // Suppress the text-selection / native-drag that a mousedown would
    // otherwise start, so the pointer is free to pan without artefacts.
    e.preventDefault();
    beginPan();
    // Drop any hover highlight: meaningless while panning, and clearing it at
    // the start means nothing re-styles during the drag.
    setHoveredNodeId((prev) => (prev === null ? prev : null));
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pX: panRef.current.x,
      pY: panRef.current.y,
    };
  }, [beginPan]);

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      // A pan is only a pan once it has actually moved; a plain click must
      // still open the node.
      if (!dragMovedRef.current && Math.abs(dx) + Math.abs(dy) > 3) {
        dragMovedRef.current = true;
      }
      const newX = dragStartRef.current.pX + dx;
      const newY = dragStartRef.current.pY + dy;

      panRef.current = { x: newX, y: newY };
      scheduleTransform();
    };

    const handleWindowMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      endPan();
      setPan({ ...panRef.current });
    };

    // A pan must end even if the window loses focus mid-drag, or the canvas
    // would stay hit-transparent with no pointer to release it.
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("blur", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("blur", handleWindowMouseUp);
      endPan();
    };
  }, [scheduleTransform, endPan]);

  // ── Touch Drag & Pinch Zoom (Ultra-Smooth 60FPS) ─────────────────────────

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
      beginPan();

      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartInfo = {
          pX: panRef.current.x,
          pY: panRef.current.y,
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
          pX: panRef.current.x,
          pY: panRef.current.y,
          startX: midX,
          startY: midY,
          startDist: dist,
          startZoom: zoomRef.current,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartInfo) return;
      e.preventDefault();

      if (e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - touchStartInfo.startX;
        const dy = t.clientY - touchStartInfo.startY;
        const newX = touchStartInfo.pX + dx;
        const newY = touchStartInfo.pY + dy;

        // Same 3px rule as the mouse path: a tap must still open the node, a
        // drag must not (the touchscreens drift more, so give it 6px).
        if (!dragMovedRef.current && Math.abs(dx) + Math.abs(dy) > 6) {
          dragMovedRef.current = true;
        }

        panRef.current = { x: newX, y: newY };
        scheduleTransform();
      } else if (e.touches.length === 2 && touchStartInfo.startDist && touchStartInfo.startZoom) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        const dx = midX - touchStartInfo.startX;
        const dy = midY - touchStartInfo.startY;
        const newX = touchStartInfo.pX + dx;
        const newY = touchStartInfo.pY + dy;

        const scale = currentDist / touchStartInfo.startDist;
        const newZoom = Math.min(Math.max(touchStartInfo.startZoom * scale, 0.5), 1.8);

        panRef.current = { x: newX, y: newY };
        zoomRef.current = newZoom;

        scheduleTransform();
      }
    };

    const handleTouchEnd = () => {
      if (touchStartInfo) {
        setPan({ ...panRef.current });
        setZoom(zoomRef.current);
        touchStartInfo = null;
      }
      endPan();
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    // Trackpad pinch-to-zoom (ctrlKey + wheel) & mouse wheel zoom handler
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      // Pinch on trackpads sets e.ctrlKey to true
      const isPinch = e.ctrlKey;
      const zoomFactor = isPinch ? Math.exp(-e.deltaY * 0.01) : Math.exp(-e.deltaY * 0.0015);

      const currentZoom = zoomRef.current;
      const targetZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.4), 2.2);

      if (targetZoom === currentZoom) return;

      // Adjust pan so zooming centers around cursor
      const currentPan = panRef.current;
      const mouseCanvasX = (cursorX - currentPan.x) / currentZoom;
      const mouseCanvasY = (cursorY - currentPan.y) / currentZoom;

      const newPanX = cursorX - mouseCanvasX * targetZoom;
      const newPanY = cursorY - mouseCanvasY * targetZoom;

      panRef.current = { x: newPanX, y: newPanY };
      zoomRef.current = targetZoom;

      scheduleTransform();

      setPan({ x: newPanX, y: newPanY });
      setZoom(targetZoom);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      container.removeEventListener("wheel", handleWheel);
      endPan();
    };
  }, [scheduleTransform, endPan, beginPan]);

  // Start centered on the root node: the full 16-branch tree is far larger
  // than any viewport, so the default top-left pan at 100% shows only a
  // handful of nodes in a huge empty panel. Touch zooms out a bit for a
  // wider view; desktop keeps a readable zoom on the root.
  useEffect(() => {
    if (didInitView.current) return;
    const container = containerRef.current;
    const root = nodes.find((n) => n.prerequisites.length === 0) ?? nodes[0];
    if (!container || !root) return;
    didInitView.current = true;
    const scale = isTouch ? 0.6 : 0.9;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const initialPan = {
      x: cw / 2 - (root.x + 34) * scale,
      y: ch / 2 - (root.y + 34) * scale,
    };
    updateZoom(scale);
    updatePan(initialPan);
  }, [isTouch, nodes, updatePan, updateZoom]);

  const resetView = useCallback(() => {
    const container = containerRef.current;
    if (nodes.length === 0) {
      updateZoom(0.4);
      updatePan({ x: 50, y: 50 });
      return;
    }

    // Compute bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    });

    // Node diameter + label margin offset ~100px
    maxX += 100;
    maxY += 100;

    const treeWidth = maxX - minX;
    const treeHeight = maxY - minY;
    const treeCenterX = minX + treeWidth / 2;
    const treeCenterY = minY + treeHeight / 2;

    const cw = container ? container.clientWidth : 1000;
    const ch = container ? container.clientHeight : 600;

    // Minimum zoom limit level (0.4) to show maximum context
    const minZoomLimit = 0.4;
    const scaleX = (cw * 0.85) / Math.max(1, treeWidth);
    const scaleY = (ch * 0.85) / Math.max(1, treeHeight);
    const targetZoom = Math.min(minZoomLimit, Math.max(0.4, Math.min(scaleX, scaleY)));

    const centeredPan = {
      x: cw / 2 - treeCenterX * targetZoom,
      y: ch / 2 - treeCenterY * targetZoom,
    };

    updateZoom(targetZoom);
    updatePan(centeredPan);
  }, [nodes, updatePan, updateZoom]);

  const handleZoomIn = useCallback(() => updateZoom(zoomRef.current + 0.15), [updateZoom]);
  const handleZoomOut = useCallback(() => updateZoom(zoomRef.current - 0.15), [updateZoom]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className={cn(
        // `skill-canvas` is the hook the `.is-panning` rule in index.css needs to
        // make the node subtree hit-transparent while a pan is in flight.
        "skill-canvas relative w-full flex-1 min-h-130 overflow-hidden rounded-xl border border-line/80 touch-none",
        "bg-canvas/95 select-none cursor-grab active:cursor-grabbing shadow-inner",
      )}
    >
      {/* Subtle Grid Pattern Background */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-size-[24px_24px] opacity-35 pointer-events-none" />

      {/* Floating Viewport Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-lg bg-surface border border-line shadow-sm text-xs font-mono max-lg:top-auto max-lg:bottom-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-ink-3 hover:text-ink max-lg:h-9 max-lg:w-9 cursor-pointer"
              onClick={handleZoomIn}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("zoomIn")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-ink-3 hover:text-ink max-lg:h-9 max-lg:w-9 cursor-pointer"
              onClick={handleZoomOut}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("zoomOut")}</TooltipContent>
        </Tooltip>
        <div className="w-px h-4 bg-line" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-ink-3 hover:text-ink max-lg:h-9 max-lg:w-9 cursor-pointer"
              onClick={resetView}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("resetView")}</TooltipContent>
        </Tooltip>
        <span className="px-2 text-[0.62rem] text-ink-3 font-semibold">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Hardware-Accelerated Canvas Viewport Layer */}
      <div
        ref={transformRef}
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

            return (
              <SkillEdge
                key={c.id}
                pathD={pathD}
                isActive={hoveredNodeId === c.from.id || hoveredNodeId === c.to.id}
                isUnlockedLink={c.from.status === "completed" || c.from.status === "unlocked"}
                dashed={c.to.status === "locked"}
              />
            );
          })}
        </svg>

        {/* Round Nodes Layer */}
        <div data-skill-nodes className="absolute inset-0 w-[7200px] h-[3400px]">
          {nodes.map((node) => (
            <SkillNodeItem
              key={node.id}
              node={node}
              isHovered={hoveredNodeId === node.id}
              onMouseEnter={handleMouseEnterNode}
              onMouseLeave={handleMouseLeaveNode}
              onSelectNode={handleSelectNode}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      </div>

      {/* Footer Info Legend */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 text-xs text-ink-3 bg-surface px-3 py-1.5 rounded-lg border border-line shadow-sm max-lg:hidden">
        <Info className="w-3.5 h-3.5 text-ink shrink-0" />
        <span>{t("canvasHint")}</span>
      </div>
    </div>
  );
}
