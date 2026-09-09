'use client';

import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronDown,
  GitCommitHorizontal,
  History,
  LayoutGrid,
  ListOrdered,
  Notebook,
  Scale,
  Shuffle,
  TrendingDown,
} from 'lucide-react';
import { DEMO_SESSION_NAME, DEMO_SOLVES } from './demoData';

const WIDGET_ICONS = [
  ListOrdered,
  Shuffle,
  BarChart3,
  TrendingDown,
  GitCommitHorizontal,
  Scale,
  Activity,
  Notebook,
  BookOpen,
  LayoutGrid,
];

/**
 * Static clone of the default desktop dock (pill bar) for the preview.
 * Same bar/pill/session/puzzle geometry as `WidgetDock`, demo content.
 */
export function PreviewDock({ background }: { background: string }) {
  return (
    <div aria-hidden="true" className="flex justify-center">
      <div
        role="toolbar"
        data-slot="dock"
        data-glass-panel="true"
        className="relative z-10 flex min-w-0 items-center gap-0.5 rounded-full border border-line px-1.5 py-1 shadow-sm"
        style={{ backgroundColor: background }}
      >
        {WIDGET_ICONS.map((Icon, i) => (
          <div
            key={i}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2"
          >
            <Icon className="size-4" />
          </div>
        ))}
        <div className="mx-1 h-5 w-px bg-line/80" />
        <div className="w-3" />
        <div className="flex h-8 items-center gap-1.5 rounded-full px-2.5 py-0 text-xs font-medium leading-none text-ink-2">
          <History className="size-3.5 shrink-0 text-ink-3" />
          <span className="nums max-w-28 truncate leading-none">{DEMO_SESSION_NAME}</span>
          <span className="leading-none text-ink-3">·</span>
          <span className="nums leading-none text-ink-3">{DEMO_SOLVES.length}</span>
        </div>
        <div className="flex h-8 items-center gap-2 rounded-full border-transparent bg-transparent py-0 pl-2.5 pr-2 text-xs font-medium leading-normal text-ink-2 shadow-none">
          <span>3×3</span>
          <ChevronDown className="size-3 text-ink-3" />
        </div>
      </div>
    </div>
  );
}
