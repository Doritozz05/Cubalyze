import {
  RefreshCw,
  Copy,
  Plus,
  Puzzle,
  Settings,
  LayoutGrid,
  LayoutTemplate,
  Timer,
} from "lucide-react";
import type { ContextMenuItem } from "./contextMenuStore";

export interface ContextMenuHandlerMap {
  onRegenerate: () => void;
  onCopyScramble: () => void;
  onOpenManual: () => void;
  onOpenSettings: (section?: string) => void;
  onOpenThemeStudio: (tab?: "presets" | "layout" | "colors") => void;
  onOpenWidgets: () => void;
  onNavigate: (view: string) => void;
}

export interface ResolveContextMenuContext {
  activeView: string;
  zone: string | null;
  target: HTMLElement | null;
  handlers: ContextMenuHandlerMap;
}

/**
 * Resolves context menu items based on the current active view,
 * DOM context zone, and target element.
 */
export function resolveContextMenuItems(ctx: ResolveContextMenuContext): ContextMenuItem[] {
  const { activeView, zone, handlers } = ctx;

  // 1. Timer stage view
  if (activeView === "timer") {
    // A. Click on the bottom layout
    if (zone === "bottom-layout") {
      return [
        {
          id: "customize-bottom-layout",
          label: "customizeBottomLayout",
          icon: LayoutTemplate,
          onClick: () => handlers.onOpenThemeStudio("layout"),
        },
        {
          id: "new-scramble",
          label: "newScramble",
          icon: RefreshCw,
          separatorBefore: true,
          onClick: () => handlers.onRegenerate(),
        },
        {
          id: "settings",
          label: "settings",
          icon: Settings,
          onClick: () => handlers.onOpenSettings(),
        },
      ];
    }

    // B. Click on the dock
    if (zone === "dock") {
      return [
        {
          id: "edit-dock",
          label: "editDock",
          icon: LayoutGrid,
          onClick: () => {
            import("@/widgets/dock/dockEditStore").then((m) => m.dockEditStore.startEditing());
          },
        },
        {
          id: "new-scramble",
          label: "newScramble",
          icon: RefreshCw,
          separatorBefore: true,
          onClick: () => handlers.onRegenerate(),
        },
        {
          id: "copy-scramble",
          label: "copyScramble",
          icon: Copy,
          onClick: () => handlers.onCopyScramble(),
        },
        {
          id: "settings",
          label: "settings",
          icon: Settings,
          onClick: () => handlers.onOpenSettings(),
        },
      ];
    }

    // C. Default Timer Stage
    return [
      {
        id: "new-scramble",
        label: "newScramble",
        icon: RefreshCw,
        onClick: () => handlers.onRegenerate(),
      },
      {
        id: "copy-scramble",
        label: "copyScramble",
        icon: Copy,
        onClick: () => handlers.onCopyScramble(),
      },
      {
        id: "add-manual",
        label: "addManualSolve",
        icon: Plus,
        onClick: () => handlers.onOpenManual(),
      },
      {
        id: "open-widgets",
        label: "openWidgets",
        icon: Puzzle,
        separatorBefore: true,
        onClick: () => handlers.onOpenWidgets(),
      },
      {
        id: "settings",
        label: "settings",
        icon: Settings,
        onClick: () => handlers.onOpenSettings(),
      },
    ];
  }

  // 2. Non-timer views (Insights, Training, Algorithms, Reconstructions, etc.)
  return [
    {
      id: "go-to-timer",
      label: "goToTimer",
      icon: Timer,
      onClick: () => handlers.onNavigate("timer"),
    },
    {
      id: "settings",
      label: "settings",
      icon: Settings,
      separatorBefore: true,
      onClick: () => handlers.onOpenSettings(),
    },
  ];
}
