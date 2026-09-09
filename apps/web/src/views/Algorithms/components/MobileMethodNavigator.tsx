"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  FolderTree,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { TouchPanel } from "@/components/TouchPanel";
import { METHODS, getSubsetsForMethod, getChildSubsets } from "@cubeforge/algorithm-db";
import type { AlgorithmSubset } from "@cubeforge/algorithm-db";
import { PUZZLE_LABELS, PUZZLE_ORDER, type PuzzleType } from "@/utils/puzzleTypes";

// ── Tree model (generic — scales to any nesting depth) ─────────────────────

interface NavNode {
  id: string;
  label: string;
  kind: "puzzle" | "method" | "subset";
  children?: NavNode[];
}

function subsetNode(subset: AlgorithmSubset): NavNode {
  const children = getChildSubsets(subset.id).filter((c) => c.sortOrder > 0);
  if (children.length > 0) {
    return {
      id: subset.id,
      label: subset.name,
      kind: "subset",
      children: children.map(subsetNode),
    };
  }
  return { id: subset.id, label: subset.name, kind: "subset" };
}

export function buildTree(): NavNode[] {
  return PUZZLE_ORDER.filter((pt) =>
    METHODS.some((m) => (m.puzzleType as PuzzleType) === pt),
  ).map((pt) => {
    const methods = METHODS.filter(
      (m) => (m.puzzleType as PuzzleType) === pt,
    );
    return {
      id: pt,
      label: PUZZLE_LABELS[pt] ?? pt,
      kind: "puzzle",
      children: methods.map((m) => {
        const subsets = getSubsetsForMethod(m.id)
          .filter((s) => s.sortOrder > 0)
          .map(subsetNode);

        // If a method has exactly one subset with no children (e.g. CLL),
        // flatten it so tapping the method directly selects the subset instead of showing
        // a redundant single-item submenu ("CLL de nuevo").
        if (
          subsets.length === 1 &&
          (!subsets[0].children || subsets[0].children.length === 0)
        ) {
          return {
            id: subsets[0].id,
            label: m.name,
            kind: "subset" as const,
          };
        }

        return {
          id: m.id,
          label: m.name,
          kind: "method" as const,
          children: subsets,
        };
      }),
    };
  });
}

/** Breadcrumb path labels for a given subset id, e.g. "3×3 › CFOP › PLL" or "2×2 › CLL". */
export function pathLabelFor(
  tree: NavNode[],
  subsetId: string | null,
  selectMethodLabel: string,
): string {
  if (!subsetId) return selectMethodLabel;
  const found = findIn(tree, subsetId, []);
  if (found) return found.join(" › ");
  return selectMethodLabel;
}

function findIn(
  nodes: NavNode[],
  id: string,
  trail: string[],
): string[] | null {
  for (const node of nodes) {
    if (node.id === id) return [...trail, node.label];
    if (node.children && node.children.length > 0) {
      const found = findIn(node.children, id, [...trail, node.label]);
      if (found) return found;
    }
  }
  return null;
}

/** All leaf subsets with their full path (for instant search). */
function flattenLeaves(
  nodes: NavNode[],
  trail: string[] = [],
): { id: string; label: string; path: string }[] {
  const out: { id: string; label: string; path: string }[] = [];
  for (const node of nodes) {
    if (!node.children || node.children.length === 0) {
      out.push({ id: node.id, label: node.label, path: [...trail, node.label].join(" › ") });
    } else {
      out.push(...flattenLeaves(node.children, [...trail, node.label]));
    }
  }
  return out;
}

// ── Component ───────────────────────────────────────────────────────────────

export interface MobileMethodNavigatorProps {
  selectedSubsetId: string | null;
  onSelectSubset: (subsetId: string) => void;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

/**
 * Touch (<768px) method navigator for the Algorithms view.
 *
 * Desktop keeps the collapsible `MethodTree`. On touch, a compact path bar
 * (e.g. "3×3 › CFOP › PLL ▾") opens an iOS-style drill-down sheet: each level
 * renders only its own items and pushes deeper, so it scales to any future
 * nesting depth. Breadcrumbs let you jump back, and instant search finds any
 * subset across the whole tree.
 */
export function MobileMethodNavigator({
  selectedSubsetId,
  onSelectSubset,
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen,
}: MobileMethodNavigatorProps) {
  const { t } = useTranslation("algorithms");
  const tree = useMemo(buildTree, []);
  const leaves = useMemo(() => flattenLeaves(tree), [tree]);

  const [internalOpen, setInternalOpen] = useState(
    () => defaultOpen ?? !selectedSubsetId,
  );
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      controlledOnOpenChange?.(next);
    },
    [isControlled, controlledOnOpenChange],
  );

  // Path of selected nodes; the visible list is the last node's children
  // (or the roots when empty).
  const [path, setPath] = useState<NavNode[]>(() =>
    findPathTo(tree, selectedSubsetId),
  );
  const [query, setQuery] = useState("");

  const currentList =
    path.length === 0 ? tree : (path[path.length - 1].children ?? []);

  const barLabel = useMemo(
    () => pathLabelFor(tree, selectedSubsetId, t("selectMethod")),
    [tree, selectedSubsetId, t],
  );

  const handleOpen = useCallback(() => {
    setQuery("");
    // Pre-navigate to the level containing the current selection (or [] for root).
    setPath(findPathTo(tree, selectedSubsetId));
    setOpen(true);
  }, [tree, selectedSubsetId, setOpen]);

  // Synchronize path and clear query whenever drawer is opened externally
  useEffect(() => {
    if (controlledOpen) {
      setQuery("");
      setPath(findPathTo(tree, selectedSubsetId));
    }
  }, [controlledOpen, tree, selectedSubsetId]);

  const handleTap = useCallback(
    (node: NavNode) => {
      if (node.children && node.children.length > 0) {
        setPath((p) => [...p, node]);
      } else {
        onSelectSubset(node.id);
        setOpen(false);
      }
    },
    [onSelectSubset, setOpen],
  );

  const handleJumpTo = useCallback((depth: number) => {
    setPath((p) => p.slice(0, depth));
  }, []);

  const panelTitle = useMemo(() => {
    if (path.length === 0) return t("puzzle", { defaultValue: "Puzzle" });
    if (path.length === 1) return t("method", { defaultValue: "Método" });
    return t("method");
  }, [path.length, t]);

  const filteredLeaves = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return leaves.filter(
      (l) => l.label.toLowerCase().includes(q) || l.path.toLowerCase().includes(q),
    );
  }, [query, leaves]);

  return (
    <div className={cn("w-full", className)}>
      {/* Path bar — opens the sheet */}
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        data-glass-panel
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 text-left shadow-xs touch-manipulation select-none"
      >
        <FolderTree className="size-4 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate text-[0.78rem] font-medium text-ink">
          {barLabel}
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-3" />
      </button>

      <TouchPanel open={open} onOpenChange={setOpen} title={panelTitle}>
        {/* The drawer portals to document.body, so the flat-button zone must
            live INSIDE it — a zone on this root never reaches the sheet rows. */}
        <div data-context-zone="algorithms-nav">
        {/* Instant search — jump straight to any subset */}
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchSubsets")}
            className="h-11 w-full rounded-xl border border-line bg-canvas pl-9 pr-3 text-[0.8rem] text-ink outline-none transition-colors placeholder:text-ink-3/60 focus:border-ink-2 touch-manipulation"
          />
        </div>

        {query.trim() ? (
          /* ── Search results ── */
          <div className="flex flex-col">
            {filteredLeaves.length === 0 ? (
              <p className="py-6 text-center text-[0.72rem] text-ink-3">
                {t("noSubsetsMatch", { query: query.trim() })}
              </p>
            ) : (
              filteredLeaves.map((leaf) => {
                const isSelected = leaf.id === selectedSubsetId;
                return (
                  <button
                    key={leaf.id}
                    type="button"
                    onClick={() => {
                      onSelectSubset(leaf.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors touch-manipulation",
                      isSelected ? "bg-surface-2" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.68rem] text-ink-3">
                        {leaf.path}
                      </span>
                      <span className="block truncate text-[0.78rem] font-medium text-ink">
                        {leaf.label}
                      </span>
                    </span>
                    {isSelected && <Check className="size-4 shrink-0 text-ink" />}
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <>
            {/* ── Breadcrumbs — tap to jump back ── */}
            {path.length > 0 && (
              <div className="mb-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
                <button
                  type="button"
                  onClick={() => setPath((p) => p.slice(0, -1))}
                  aria-label={t("back")}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink touch-manipulation"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {path.map((node, i) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleJumpTo(i + 1)}
                    className={cn(
                      "shrink-0 rounded-lg px-2.5 py-1.5 text-[0.72rem] font-medium transition-colors touch-manipulation",
                      i === path.length - 1
                        ? "bg-ink text-surface"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {node.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Current level list ── */}
            <div className="flex flex-col">
              {currentList.map((node) => {
                const hasChildren = !!node.children && node.children.length > 0;
                const isSelected = node.id === selectedSubsetId;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleTap(node)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left transition-colors touch-manipulation",
                      isSelected ? "bg-surface-2" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[0.8rem] font-medium text-ink">
                      {node.label}
                    </span>
                    {hasChildren ? (
                      <ChevronRight className="size-4 shrink-0 text-ink-3" />
                    ) : isSelected ? (
                      <Check className="size-4 shrink-0 text-ink" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
        </div>
      </TouchPanel>
    </div>
  );
}

/** Find the node path that leads to the given subset id (for pre-navigation). */
export function findPathTo(nodes: NavNode[], id: string | null): NavNode[] {
  if (!id) return [];
  const found = findPathHelper(nodes, id);
  return found ?? [];
}

function findPathHelper(nodes: NavNode[], id: string): NavNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [];
    if (node.children && node.children.length > 0) {
      const sub = findPathHelper(node.children, id);
      if (sub !== null) {
        return [node, ...sub];
      }
    }
  }
  return null;
}
