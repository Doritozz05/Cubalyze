'use client';

import { BarChart3, BookOpen, History, Menu, Target, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { DEMO_SESSION_NAME } from './demoData';

const TABS = [
  { icon: Target, labelKey: 'training' },
  { icon: BookOpen, labelKey: 'algorithms' },
  { icon: Timer, labelKey: 'timer' },
  { icon: BarChart3, labelKey: 'stats' },
] as const;

/**
 * Static clone of the <768px header: More · puzzle/session · session icon.
 * Same glass hook and geometry as the real mobile header. Deliberately a
 * DIV (not <header>): the global `html.liquid-glass header` rules are gated
 * on the REAL viewport width and would wrongly restyle the virtual frame.
 */
export function PreviewMobileHeader({ background }: { background: string }) {
  return (
    <div
      aria-hidden="true"
      data-glass-panel="true"
      className="relative -mx-6 -mt-6 flex h-22 w-[calc(100%+48px)] shrink-0 items-center justify-between border-b border-line px-10 pt-6"
      style={{ backgroundColor: background }}
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-full text-ink-2">
        <Menu className="size-5" />
      </div>
      <div className="absolute left-1/2 top-[calc(50%+12px)] flex max-w-[46%] -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <span className="text-sm font-semibold leading-normal text-ink">3×3</span>
        <span className="max-w-36 truncate text-[0.62rem] font-medium text-ink-3">
          {DEMO_SESSION_NAME}
        </span>
      </div>
      <div className="grid size-9 shrink-0 place-items-center rounded-full text-ink-2">
        <History className="size-5" />
      </div>
    </div>
  );
}

/** Static clone of the mobile bottom tab bar (timer tab active). */
export function PreviewMobileTabBar({ background }: { background: string }) {
  const { t } = useTranslation('nav');
  return (
    <nav
      aria-hidden="true"
      data-slot="mobile-tab-bar"
      data-glass-panel="true"
      className="relative -mx-6 -mb-6 flex h-22 w-[calc(100%+48px)] shrink-0 items-start border-t border-line pb-6 backdrop-blur-xl select-none"
      style={{ backgroundColor: background }}
    >
      <div className="flex h-16 w-full items-center px-8">
        {TABS.map((tab, i) => {
          const active = i === 2;
          return (
            <div
              key={tab.labelKey}
              className={cn(
                'relative flex min-h-11 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg text-[0.6rem] font-medium select-none',
                active ? 'font-semibold text-primary' : 'text-ink-3',
              )}
            >
              <tab.icon className={cn('size-5', active && 'scale-105')} />
              <span className="leading-none">{t(tab.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
