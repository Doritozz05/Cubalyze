"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Settings, Bluetooth, Palette, User, Network, Box, LayoutGrid, Package, Scale, Users } from "lucide-react";
import { FaListOl } from "react-icons/fa";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ThemeStudioModal } from "@/components/Settings/theme-studio/ThemeStudioModal";
import { hapticTap } from "@/utils/haptics";
import { cn } from "@/lib/utils";
import type { ViewId } from "./sidebar.constants";

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenCubeConnector: () => void;
  onOpenProfile: () => void;
  onOpenWidgets: () => void;
  onNavigate?: (view: ViewId) => void;
}

interface MoreItem {
  key: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function MobileMoreSheet({
  open,
  onOpenChange,
  onOpenSettings,
  onOpenCubeConnector,
  onOpenProfile,
  onOpenWidgets,
  onNavigate,
}: MobileMoreSheetProps) {
  const { t } = useTranslation("shell");
  const { t: tNav } = useTranslation("nav");
  const { t: tCommon } = useTranslation();
  const { t: tLegal } = useTranslation("legal");
  const navigate = useNavigate();

  const handleAction = (action: () => void) => {
    hapticTap();
    onOpenChange(false);
    // Small delay to allow sheet close animation to start smoothly
    setTimeout(() => {
      action();
    }, 150);
  };

  const [themeStudioOpen, setThemeStudioOpen] = useState(false);

  // Actions are rendered as a 2-column grid. Titles/subtitles are resolved
  // with t() inside the component (render time) so they follow language
  // changes. Widgets live here too — the mobile header has no widgets
  // button; everything opens from this sheet.
  // Order mirrors the desktop rail's new grouping: Progress (skill tree),
  // Practice (reconstructions), Explore/Collection, then the account/theme
  // entries.
  const items: MoreItem[] = [
    {
      key: "skill-tree",
      icon: Network,
      title: tNav("skills"),
      subtitle: t("more.skillsSubtitle"),
      onClick: () => handleAction(() => onNavigate?.("skill-tree")),
    },
    {
      key: "reconstructions",
      icon: FaListOl,
      title: tNav("reconstructions"),
      subtitle: t("more.reconstructionsSubtitle"),
      onClick: () => handleAction(() => onNavigate?.("reconstructions")),
    },
    {
      key: "collection",
      icon: Package,
      title: tNav("locker"),
      subtitle: t("more.collectionSubtitle"),
      onClick: () => handleAction(() => onNavigate?.("collection")),
    },
    {
      key: "widgets",
      icon: LayoutGrid,
      title: tCommon("widgets"),
      subtitle: t("more.widgetsSubtitle"),
      onClick: () => handleAction(onOpenWidgets),
    },
    {
      key: "settings",
      icon: Settings,
      title: tCommon("settings"),
      subtitle: t("more.settingsSubtitle"),
      onClick: () => handleAction(onOpenSettings),
    },
    {
      key: "profile",
      icon: User,
      title: tCommon("profile"),
      subtitle: t("more.profileSubtitle"),
      onClick: () => handleAction(onOpenProfile),
    },
    {
      // Fase 8 — the same entry the desktop rail has, so the section is
      // reachable on a phone (the sheet is the mobile "everything else").
      key: "friends",
      icon: Users,
      title: tNav("friends"),
      subtitle: t("more.friendsSubtitle"),
      onClick: () => handleAction(() => onNavigate?.("friends")),
    },
    {
      key: "virtual-cube",
      icon: Box,
      title: tNav("virtual"),
      subtitle: t("more.virtualSubtitle"),
      onClick: () => handleAction(() => onNavigate?.("cube")),
    },
    {
      key: "smart-cube",
      icon: Bluetooth,
      title: t("smartCube"),
      subtitle: t("more.smartCubeSubtitle"),
      onClick: () => handleAction(onOpenCubeConnector),
    },
    {
      key: "theme",
      icon: Palette,
      title: tCommon("theme"),
      subtitle: t("more.themeSubtitle"),
      onClick: () => handleAction(() => setThemeStudioOpen(true)),
    },
    {
      // Public legal hub (privacy + terms + storage tabs): visible from the
      // home surface so reviewers and users always find it in one tap.
      key: "privacy",
      icon: Scale,
      title: tLegal("navPrivacy"),
      subtitle: t("more.privacySubtitle"),
      onClick: () => handleAction(() => navigate("/privacy")),
    },
  ];

  const lastStretches = items.length % 2 === 1;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-surface text-ink border-line rounded-t-2xl max-h-[80vh] flex flex-col p-0 pb-safe focus:outline-none">
          <DrawerHeader className="shrink-0 border-b border-line px-5 py-3.5 text-left">
            <DrawerTitle className="text-sm font-semibold text-ink">
              {tNav("moreOptions")}
            </DrawerTitle>
          </DrawerHeader>

          {/* Grid of secondary action cards.
              `min-h-0 flex-1 overflow-y-auto` is required: the drawer caps at
              80vh while the grid keeps growing with every destination, and a
              non-scrolling flex child is clipped instead of reachable. */}
          <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto overscroll-contain p-4">
            {items.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === items.length - 1;
              const stretches = isLast && lastStretches;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    "flex flex-col items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 p-4 text-left transition-all active:scale-[0.98] active:bg-surface-2 hover:border-line-2 cursor-pointer",
                    stretches && "col-span-2 flex-row items-center gap-3",
                  )}
                >
                  <div className="grid size-9 place-items-center rounded-lg bg-surface border border-line text-ink shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-ink">
                      {item.title}
                    </span>
                    <span className="block text-[0.65rem] text-ink-3 mt-0.5 leading-tight">
                      {item.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
      <ThemeStudioModal open={themeStudioOpen} onOpenChange={setThemeStudioOpen} />
    </>
  );
}
