'use client';

import { BarChart3 } from 'lucide-react';
import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import type { SolveMethod } from '@/types';

const METHODS: { id: SolveMethod; label: string; desc: string }[] = [
  { id: 'CFOP', label: 'CFOP', desc: 'Cross, F2L, OLL, PLL — the most popular method.' },
  { id: 'Roux', label: 'Roux', desc: 'Blockbuilding with CMLL and LSE — no rotations.' },
  { id: 'ZZ', label: 'ZZ', desc: 'Edge orientation first, then rotationless F2L + LL.' },
  { id: 'Petrus', label: 'Petrus', desc: 'Blockbuilding with early edge orientation.' },
];

export function AnalysisSection() {
  const method = useStore(preferencesStore, (s) => s.method);
  const setMethod = useStore(preferencesStore, (s) => s.setMethod);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <BarChart3 className="size-4 text-ink-2" />
        </div>
        <div>
          <p className="text-[0.82rem] text-ink-2">
            Select your solving method. Phase detection and metrics will adapt
            automatically. Analysis runs when a Smart Cube is connected.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[0.72rem] font-medium uppercase tracking-[0.12em] text-ink-3">
          Solving Method
        </h3>
        <div className="flex flex-col gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                method === m.id
                  ? 'border-blue-500/30 bg-blue-500/5 ring-1 ring-blue-500/20'
                  : 'border-line bg-surface hover:border-line-2'
              }`}
            >
              <div className="flex-1 min-w-0">
                <span className={`text-[0.82rem] font-medium ${
                  method === m.id ? 'text-blue-600' : 'text-ink'
                }`}>
                  {m.label}
                </span>
                <p className="mt-0.5 text-[0.72rem] text-ink-3 leading-relaxed">
                  {m.desc}
                </p>
              </div>
              {method === m.id && (
                <span className="mt-0.5 size-2.5 shrink-0 rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
