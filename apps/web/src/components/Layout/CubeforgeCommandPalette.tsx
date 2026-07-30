import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Timer,
  BarChart3,
  BookOpen,
  Dumbbell,
  Puzzle,
  Settings,
  Network,
  Crosshair,
  SquareStack,
  Sparkles,
  Zap,
  Grid3x3,
  Flame,
  Eye,
  RotateCcw,
  Download,
  Keyboard,
  ArrowRight,
  Box,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSeedData } from "@cubeforge/algorithm-db";
import type { ViewId } from "@/components/Layout/sidebar.constants";

export interface CubeforgeCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: ViewId) => void;
  onOpenSettings?: () => void;
  onOpenWidgets?: () => void;
  onToggle3DCube?: () => void;
  onSelectAlgorithmCase?: (subsetId: string, caseId: string) => void;
}

interface CommandItemData {
  id: string;
  category: "actions" | "nav" | "algorithms" | "skills" | "tools";
  label: string;
  description: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  badge?: string;
}

export function CubeforgeCommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onOpenSettings,
  onOpenWidgets,
  onToggle3DCube,
  onSelectAlgorithmCase,
}: CubeforgeCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global ⌘K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Load dynamic seed algorithm database (PLL & OLL cases)
  const seedData = useMemo(() => getSeedData(), []);

  // Command items catalog
  const staticCommands: CommandItemData[] = useMemo(
    () => [
      // Quick Actions
      {
        id: "quick-solve",
        category: "actions",
        label: "Start live timer",
        description: "Jump to timer stage and begin timing solves",
        icon: Timer,
        shortcut: "Space",
        action: () => onNavigate("timer"),
      },
      {
        id: "toggle-3d",
        category: "actions",
        label: "Toggle interactive 3D cube",
        description: "Open or collapse the interactive 3D virtual cube inspector",
        icon: Box,
        shortcut: "⌘ 3",
        action: () => onToggle3DCube?.(),
      },
      {
        id: "open-widgets",
        category: "actions",
        label: "Widget explorer",
        description: "Manage and configure interactive workspace widgets",
        icon: Puzzle,
        shortcut: "⌘ W",
        action: () => onOpenWidgets?.(),
      },

      // Navigation
      {
        id: "nav-timer",
        category: "nav",
        label: "Timer stage",
        description: "Main timing dashboard, live scramble & session list",
        icon: Timer,
        shortcut: "G T",
        action: () => onNavigate("timer"),
      },
      {
        id: "nav-training",
        category: "nav",
        label: "Training suite",
        description: "Targeted phase practice (Cross, F2L, OLL, PLL, Drills)",
        icon: Dumbbell,
        shortcut: "G E",
        action: () => onNavigate("training"),
      },
      {
        id: "nav-practice",
        category: "nav",
        label: "Algorithm library",
        description: "Explore CFOP cases, triggers & alternative algorithms",
        icon: BookOpen,
        shortcut: "G A",
        action: () => onNavigate("practice"),
      },
      {
        id: "nav-stats",
        category: "nav",
        label: "Stats & analytics",
        description: "Advanced performance metrics, trends & solve graphs",
        icon: BarChart3,
        shortcut: "G S",
        action: () => onNavigate("insights"),
      },
      {
        id: "nav-skill-tree",
        category: "nav",
        label: "Skills",
        description: "Interactive skill graph & technique progression path",
        icon: Network,
        shortcut: "G K",
        badge: "New",
        action: () => onNavigate("skill-tree"),
      },
      {
        id: "nav-settings",
        category: "nav",
        label: "Global preferences",
        description: "Hardware configuration, themes, inspection & sound",
        icon: Settings,
        shortcut: "G ,",
        action: () => onOpenSettings?.(),
      },

      // Speedcubing Skills
      {
        id: "skill-xcross",
        category: "skills",
        label: "XCross & advanced inspection",
        description: "Plan cross + F2L pair 1 during WCA inspection",
        icon: Crosshair,
        badge: "Elite",
        action: () => onNavigate("skill-tree"),
      },
      {
        id: "skill-pseudoslot",
        category: "skills",
        label: "Pseudo-slotting & keyhole",
        description: "Relative block building with offset D-layer",
        icon: SquareStack,
        badge: "Advanced",
        action: () => onNavigate("skill-tree"),
      },
      {
        id: "skill-eo-f2l",
        category: "skills",
        label: "Partial edge control (EO-F2L)",
        description: "Orient top layer edges during F2L insertion",
        icon: Sparkles,
        badge: "Advanced",
        action: () => onNavigate("skill-tree"),
      },
      {
        id: "skill-wv-vls",
        category: "skills",
        label: "Winter variation & VLS",
        description: "Orient corners during last slot insertion for OLL Skips",
        icon: Zap,
        badge: "Pro",
        action: () => onNavigate("skill-tree"),
      },
      {
        id: "skill-zbll",
        category: "skills",
        label: "ZBLL (472 full cases)",
        description: "1-step Last Layer resolution for oriented edges",
        icon: Grid3x3,
        badge: "Master",
        action: () => onNavigate("skill-tree"),
      },
      {
        id: "skill-pll-skip",
        category: "skills",
        label: "Forced PLL skips (OLLCP)",
        description: "Corner permutation setups to force 100% PLL skips",
        icon: Flame,
        badge: "Ultra",
        action: () => onNavigate("skill-tree"),
      },
      {
        id: "skill-3style",
        category: "skills",
        label: "3-style blindfolded commutators",
        description: "3-cycle corner/edge commutators for 3BLD execution",
        icon: Eye,
        badge: "Pro",
        action: () => onNavigate("skill-tree"),
      },

      // Tools & Session
      {
        id: "tool-reset",
        category: "tools",
        label: "Reset session solves",
        description: "Clear active session while keeping personal records",
        icon: RotateCcw,
        action: () => {},
      },
      {
        id: "tool-export",
        category: "tools",
        label: "Export solve data (CSV / JSON)",
        description: "Download full solve history and timing telemetry",
        icon: Download,
        action: () => {},
      },
      {
        id: "tool-shortcuts",
        category: "tools",
        label: "Keyboard shortcuts",
        description: "View full list of keyboard shortcuts and hotkeys",
        icon: Keyboard,
        shortcut: "?",
        action: () => {},
      },
    ],
    [onNavigate, onOpenSettings, onOpenWidgets, onToggle3DCube]
  );

  // Dynamic Algorithm Database Items
  const algorithmCommands = useMemo(() => {
    const algMap = new Map<string, string>();
    seedData.algorithms.forEach((a) => {
      if (a.caseId && (!algMap.has(a.caseId) || a.isDefault)) {
        algMap.set(a.caseId, Array.isArray(a.moves) ? a.moves.join(" ") : (a.moves ?? ""));
      }
    });

    const items: CommandItemData[] = [];
    seedData.cases.forEach((c) => {
      if (!c.id) return;
      const moves = algMap.get(c.id) || "";
      const subsetLabel = (c.subsetId || "").toUpperCase();
      items.push({
        id: `alg-${c.id}`,
        category: "algorithms",
        label: `${c.name || "Case"} (${subsetLabel})`,
        description: moves ? `Alg: ${moves}` : `${subsetLabel} Case`,
        icon: BookOpen,
        badge: subsetLabel,
        action: () => {
          if (onSelectAlgorithmCase && c.subsetId && c.id) {
            onSelectAlgorithmCase(c.subsetId, c.id);
          } else {
            onNavigate("practice");
          }
        },
      });
    });
    return items;
  }, [onNavigate, onSelectAlgorithmCase, seedData.algorithms, seedData.cases]);

  // Combine static and algorithm commands
  const allCommands = useMemo(
    () => [...staticCommands, ...algorithmCommands],
    [staticCommands, algorithmCommands]
  );

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [allCommands, query]);

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside palette (Up / Down / Enter / Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1
      );
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      const item = filteredCommands[selectedIndex];
      item.action();
      onOpenChange(false);
    }
  };

  const categoryLabels: Record<CommandItemData["category"], string> = {
    actions: "Quick actions",
    nav: "Navigation",
    algorithms: "Algorithm database (PLL & OLL)",
    skills: "Speedcubing skill graph",
    tools: "Tools & Session Controls",
  };

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Partial<Record<CommandItemData["category"], CommandItemData[]>> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category]!.push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  let globalIndexCounter = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-0 max-w-xl overflow-hidden gap-0 shadow-2xl",
          "bg-popover text-popover-foreground border border-border rounded-xl"
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center px-3.5 border-b border-border bg-card/60">
          <Search className="w-4 h-4 shrink-0 text-muted-foreground mr-2.5" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, navigation, or algorithms (e.g. T-Perm, OLL 23, Timer)..."
            className="flex-1 border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-12 text-sm text-foreground placeholder:text-muted-foreground/60"
            autoFocus
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground bg-muted border border-border rounded">
            ESC
          </kbd>
        </div>

        {/* Command List Body */}
        <div className="max-h-100 overflow-y-auto p-2 space-y-3">
          {filteredCommands.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            (Object.keys(categoryLabels) as CommandItemData["category"][]).map(
              (catKey) => {
                const items = groupedCommands[catKey];
                if (!items || items.length === 0) return null;

                return (
                  <div key={catKey} className="space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/70 tracking-wider uppercase">
                      {categoryLabels[catKey]} ({items.length})
                    </div>
                    {items.map((cmd) => {
                      const itemIndex = globalIndexCounter++;
                      const isSelected = itemIndex === selectedIndex;
                      const Icon = cmd.icon;

                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            cmd.action();
                            onOpenChange(false);
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors duration-150",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "p-1.5 rounded-md shrink-0",
                                isSelected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium leading-none truncate">
                                  {cmd.label}
                                </span>
                                {cmd.badge && (
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 text-[9px] font-semibold rounded uppercase tracking-wider",
                                      isSelected
                                        ? "bg-primary-foreground/30 text-primary-foreground"
                                        : "bg-primary/10 text-primary"
                                    )}
                                  >
                                    {cmd.badge}
                                  </span>
                                )}
                              </div>
                              <p
                                className={cn(
                                  "text-xs truncate mt-1 font-mono text-[11px]",
                                  isSelected
                                    ? "text-primary-foreground/80"
                                    : "text-muted-foreground"
                                )}
                              >
                                {cmd.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {cmd.shortcut && (
                              <kbd
                                className={cn(
                                  "px-1.5 py-0.5 text-[10px] font-mono rounded",
                                  isSelected
                                    ? "bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/30"
                                    : "bg-muted border border-border text-muted-foreground"
                                )}
                              >
                                {cmd.shortcut}
                              </kbd>
                            )}
                            <ArrowRight
                              className={cn(
                                "w-3.5 h-3.5 transition-transform",
                                isSelected
                                  ? "translate-x-0.5 text-primary-foreground"
                                  : "opacity-0"
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              }
            )
          )}
        </div>

        {/* Footer Info Bar */}
        <div className="px-3.5 py-2 border-t border-border bg-card/60 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">ESC</kbd> Close
            </span>
          </div>
          <span className="font-mono text-[10px]">CubeForge Pro v2.4</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
