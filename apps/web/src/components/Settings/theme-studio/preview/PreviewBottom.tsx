'use client';

import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { BottomLayout } from '@/bottom-layout/BottomLayout';
import { ScrambleDisplay } from '@/components/Scramble/ScrambleDisplay';
import { Scramble2DNet } from '@/components/Scramble/Scramble2DNet';
import type { DeviceMode } from '../ScaledTimerPreview';
import { evalScrambleToken, px } from './evalViewport';
import { DEMO_SCRAMBLE, DEMO_SCRAMBLE_INDEX, DEMO_SOLVES } from './demoData';

interface PreviewBottomProps {
  deviceMode: DeviceMode;
}

/**
 * The user's real bottom-layout template rendered with fixed demo solves,
 * so stats, averages and the BPA/WPA pill compute exactly like the live app.
 */
export function PreviewBottom({ deviceMode }: PreviewBottomProps) {
  const templateId = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);
  const isMobile = deviceMode === 'mobile';
  const tokenPx =
    isMobile
      ? undefined
      : px(
          evalScrambleToken(
            deviceMode === 'tablet' ? 768 : 1080,
            deviceMode === 'tablet' ? 680 : 680,
          ),
        );

  return (
    <BottomLayout
      templateId={templateId}
      solves={DEMO_SOLVES}
      compact={isMobile}
      scramble={
        <ScrambleDisplay
          scramble={DEMO_SCRAMBLE}
          indexLabel={DEMO_SCRAMBLE_INDEX}
          isScrambled
          compact={isMobile}
          tokenSizePx={tokenPx}
        />
      }
      scramble2d={<Scramble2DNet scramble={DEMO_SCRAMBLE} compact />}
    />
  );
}
