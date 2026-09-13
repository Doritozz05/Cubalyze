'use client';

import {
  BarChart3,
  Bluetooth,
  BookOpen,
  Gamepad2,
  Grid3x3,
  Network,
  Package,
  Puzzle,
  Settings,
  Target,
  Timer,
  UserRound,
  Users,
} from 'lucide-react';
import { FaListOl } from 'react-icons/fa';
import { cn } from '@/lib/utils';

// Mirrors NAV_GROUPS in sidebar.constants (icons only, decorative).
const NAV = [Timer, Gamepad2, BarChart3, Network, Target, BookOpen, FaListOl, Package, Users, Puzzle];

/**
 * Static clone of the collapsed left sidebar (56px rail) for the
 * desktop/tablet preview frames. Same element, slot and glass hooks as the
 * real rail so the liquid-glass engine treats it identically. Decorative —
 * the timer face stays live.
 */
export function PreviewRail({ background }: { background: string }) {
  return (
    <aside
      aria-hidden="true"
      data-slot="sidebar"
      data-glass-panel="true"
      className="relative -ml-6 -my-6 flex h-[calc(100%+48px)] w-20 shrink-0 touch-pan-y flex-col items-center overflow-hidden border-r border-sidebar-border pl-6 py-10 select-none"
      style={{ backgroundColor: background }}
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-ink">
        <Grid3x3 className="size-4 text-surface" />
      </div>
      <div className="mt-4 flex flex-col items-center gap-1">
        {NAV.map((Icon, i) => (
          <div
            key={i}
            className={cn(
              'relative flex size-9 items-center justify-center rounded-md',
              i === 0
                ? 'text-sidebar-foreground'
                : 'text-sidebar-foreground/70',
            )}
          >
            {i === 0 && <div className="absolute inset-0 rounded-md bg-sidebar-accent" />}
            <Icon className="relative size-4" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1">
        {[UserRound, Bluetooth, Settings].map((Icon, i) => (
          <div
            key={i}
            className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground/70"
          >
            <Icon className="size-4" />
          </div>
        ))}
      </div>
    </aside>
  );
}
