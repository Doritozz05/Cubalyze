'use client';

import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { BottomLayout } from '@/bottom-layout/BottomLayout';
import { Scramble2DNet } from '@/components/Scramble/Scramble2DNet';
import type { DeviceMode } from '../ScaledTimerPreview';
import {
  DEMO_SCRAMBLE_222,
  DEMO_SCRAMBLE_333,
  DEMO_SOLVES_222,
  DEMO_SOLVES_333,
} from './demoData';

/** Preview puzzle (mocked, like the rest of the demo data). */
export type PreviewPuzzle = '333' | '222';

import { cn } from '@/lib/utils';

interface PreviewBottomProps {
  deviceMode: DeviceMode;
  /** Right-rail mode: vertical slot stack (desktop/tablet rail templates). */
  vertical?: boolean;
  puzzle?: PreviewPuzzle;
  className?: string;
}

/**
 * The user's real slot layout rendered with fixed demo solves for the
 * selected puzzle, so stats and averages compute exactly like the live app.
 */
export function PreviewBottom({
  deviceMode,
  vertical = false,
  puzzle = '333',
  className,
}: PreviewBottomProps) {
  const templateId = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);
  const isMobile = deviceMode === 'mobile';
  const demoScramble = puzzle === '222' ? DEMO_SCRAMBLE_222 : DEMO_SCRAMBLE_333;
  const demoSolves = puzzle === '222' ? DEMO_SOLVES_222 : DEMO_SOLVES_333;

  return (
    <BottomLayout
      templateId={templateId}
      solves={demoSolves}
      puzzleFilter={puzzle}
      compact={isMobile}
      vertical={vertical}
      className={cn(vertical && 'h-full', className)}
      scramble2d={<Scramble2DNet scramble={demoScramble} compact />}
      currentScramble={demoScramble}
    />
  );
}
