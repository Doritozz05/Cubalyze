'use client';

import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { useTranslation } from 'react-i18next';
import { SettingToggle } from '../components/SettingToggle';

import { Shuffle } from 'lucide-react';

export function ScrambleSection() {
  const { t } = useTranslation('settings');
  const scrambleFollowsCube = useStore(
    preferencesStore,
    (s) => s.scrambleFollowsCube,
  );
  const setScrambleFollowsCube = useStore(
    preferencesStore,
    (s) => s.setScrambleFollowsCube,
  );

  const scrambleDisplay = useStore(
    preferencesStore,
    (s) => s.scrambleDisplay,
  );
  const setScrambleDisplay = useStore(
    preferencesStore,
    (s) => s.setScrambleDisplay,
  );

  const scrambleVerification = useStore(
    preferencesStore,
    (s) => s.scrambleVerification,
  );
  const setScrambleVerification = useStore(
    preferencesStore,
    (s) => s.setScrambleVerification,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Shuffle className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] leading-5 text-ink-2">
          {t('scramble.header')}
        </p>
      </div>

      <SettingToggle
        title={t('scramble.showScramble')}
        description={t('scramble.showScrambleHint')}
        checked={scrambleDisplay}
        onCheckedChange={setScrambleDisplay}
      />

      {scrambleDisplay && (
        <SettingToggle
          title={t('scramble.verification')}
          description={t('scramble.verificationHint')}
          checked={scrambleVerification}
          onCheckedChange={setScrambleVerification}
        />
      )}

      <SettingToggle
        title={t('scramble.rotateWithCube')}
        description={t('scramble.rotateWithCubeHint')}
        checked={scrambleFollowsCube}
        onCheckedChange={setScrambleFollowsCube}
      />
    </div>
  );
}
