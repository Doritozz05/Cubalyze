'use client';

import { BarChart3, Check } from 'lucide-react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { preferencesStore } from '@cubeforge/state';
import type { SolveMethod } from '@/types';

const METHODS: { id: SolveMethod; label: string; descKey: ParseKeys<'settings'> }[] = [
  { id: 'CFOP', label: 'CFOP', descKey: 'analysis.methodCfop' },
  { id: 'Roux', label: 'Roux', descKey: 'analysis.methodRoux' },
  { id: 'ZZ', label: 'ZZ', descKey: 'analysis.methodZz' },
  { id: 'Petrus', label: 'Petrus', descKey: 'analysis.methodPetrus' },
];

export function AnalysisSection() {
  const { t } = useTranslation('settings');
  const method = useStore(preferencesStore, (s) => s.method);
  const setMethod = useStore(preferencesStore, (s) => s.setMethod);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <BarChart3 className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] leading-5 text-ink-2">
          {t('analysis.header')}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-[0.72rem] font-medium uppercase tracking-[0.12em] text-ink-3">
          {t('analysis.solvingMethod')}
        </h3>
        <div className="flex flex-col gap-1.5">
          {METHODS.map((m) => {
            const isActive = method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                aria-pressed={isActive}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-ink-2 bg-surface-2 ring-1 ring-ink-2/30'
                    : 'border-line bg-surface hover:border-line-2 hover:bg-surface-2/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-[0.82rem] font-medium transition-colors ${
                      isActive ? 'text-ink' : 'text-ink-2'
                    }`}
                  >
                    {m.label}
                  </span>
                  <p className="mt-0.5 text-[0.72rem] text-ink-3 leading-5">
                    {t(m.descKey)}
                  </p>
                </div>
                {isActive && (
                  <Check
                    className="mt-0.5 size-3.5 shrink-0 text-ink"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
