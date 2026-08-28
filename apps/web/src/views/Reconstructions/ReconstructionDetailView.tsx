'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Video,
  Trophy,
  Calendar,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/formatTime';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/Insights/atoms';
import { MetricTile } from '@/components/Stats/atoms/MetricTile';
import { ReplaySection, type ReplaySectionHandle } from '@/components/Insights/ReplaySection';
import { fetchReconRecord, reconToSolve, type ReconFullRecord, type ReconPhase } from './reconData';
import { OurDetectionPanel } from './OurDetectionPanel';
import { formatDisplayDate } from './ReconstructionsView';

// ─── Fallback steps table (only when OUR detection isn't available) ────────

function PhaseRow({ phase, last }: { phase: ReconPhase; last: boolean }) {
  return (
    <div
      className={cn(
        'col-span-4 grid grid-cols-subgrid items-center gap-3 px-3 py-2',
        !last && 'border-line/50 border-b',
      )}
    >
      <span className="text-ink truncate text-[0.72rem] font-medium">{phase.label}</span>
      <span className="text-ink-3 text-[0.6rem]">—</span>
      <span className="text-ink-2 min-w-0 font-mono text-[0.68rem] leading-relaxed">
        {phase.moves || '—'}
      </span>
      <span className="nums text-ink-3 text-right text-xs tabular-nums">{phase.moveCount}</span>
    </div>
  );
}

function RawPhasesTable({ record }: { record: ReconFullRecord }) {
  const { t } = useTranslation('reconstructions');
  if (record.phases.length === 0) return null;
  return (
    <div className="border-line bg-surface overflow-hidden rounded-lg border">
      <div className="border-line flex items-center justify-between border-b px-4 py-3">
        <SectionHeader title={t('detail.stepsTitle')} eyebrow={t('detail.stepsEyebrow')} />
        <span className="nums text-ink-3 text-xs">
          {t('detail.movesCount', {
            count: record.phases.reduce((n, p) => n + p.moveCount, 0),
          })}
        </span>
      </div>
      <div className="grid grid-cols-[7.5rem_minmax(5rem,max-content)_1fr_2.75rem]">
        <div className="border-line bg-surface-2/50 text-ink-3 col-span-4 grid grid-cols-subgrid items-center gap-3 border-b px-3 py-1.5 text-[0.56rem] font-semibold tracking-wider uppercase">
          <span>{t('detail.colPhase')}</span>
          <span>{t('detail.colCase')}</span>
          <span>{t('detail.colMoves')}</span>
          <span className="text-right">#</span>
        </div>
        {record.phases.map((p, i) => (
          <PhaseRow key={`${p.label}-${i}`} phase={p} last={i === record.phases.length - 1} />
        ))}
      </div>
    </div>
  );
}

// ─── View ──────────────────────────────────────────────────────────────────

export function ReconstructionDetailView({
  recordKey,
  onBack,
}: {
  recordKey: string;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation('reconstructions');
  const [record, setRecord] = useState<ReconFullRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Imperative replay control — phase rows in OurDetectionPanel seek the
  // cube to the state right before the clicked phase's first move.
  const replayRef = useRef<ReplaySectionHandle>(null);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setError(null);
    fetchReconRecord(recordKey)
      .then((r) => {
        if (!cancelled) setRecord(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('detail.errorLoad'));
      });
    return () => {
      cancelled = true;
    };
    // t is stable across renders; fallback message is static per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordKey]);

  const solve = useMemo(() => (record ? reconToSolve(record) : null), [record]);

  const handleCopy = useCallback(async () => {
    if (!record) return;
    try {
      await navigator.clipboard.writeText(record.text || record.scramble);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [record]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="text-dnf text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" /> {i18n.t('common:back')}
        </Button>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex h-full flex-col gap-4 px-6 py-5">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-12 w-28" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(19rem,26rem)]">
          <Skeleton className="h-80 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const stm = record.stm;
  const tps = record.tps;
  const dateDisplay = formatDisplayDate(record.date, record.competition, record.url);

  // OUR detection replaces the reconstructor's hardcoded phase table for CFOP
  // 3×3 records with a valid state-based analysis (orientation/cross/F2L/OLL/PLL).
  const canDetect = record.methodGroup === 'CFOP' && record.puzzle === '3x3';
  const hasDetection = canDetect && record.ourDetection !== null;
  const showRawPhases = !hasDetection;

  const actions = (
    <div className="flex items-center gap-1.5">
      {record.url && (
        <a
          href={record.url}
          target="_blank"
          rel="noreferrer"
          className="text-ink-3 hover:bg-surface-2 hover:text-ink flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
        >
          <ExternalLink className="size-3.5" /> {t('detail.source')}
        </a>
      )}
      {record.stats.videoUrl && (
        <a
          href={record.stats.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-ink-3 hover:bg-surface-2 hover:text-ink flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
        >
          <Video className="size-3.5" /> {t('detail.video')}
        </a>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="text-ink-3 hover:text-ink h-8 gap-1.5 px-2.5 text-xs"
      >
        {copied ? <Check className="text-ready size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? t('detail.copied') : t('detail.copy')}
      </Button>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ── Header: identity + context, fixed, flush with sidebar/replay ── */}
      <header className="shrink-0 border-b border-line bg-surface/40 px-5 pb-4 pt-3 sm:px-6">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="text-ink-3 hover:text-ink flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" /> {t('detail.back')}
          </button>
        </div>

        <div className="mt-2.5">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            {/* Time + solver + provenance */}
            <div className="flex min-w-0 flex-wrap items-end gap-x-6 gap-y-2">
              <div className="nums text-ink text-4xl sm:text-5xl leading-none font-semibold tracking-tight tabular-nums">
                {record.time > 0 ? formatTime(record.time * 1000) : '—'}
              </div>
              <div className="min-w-0 pb-1">
                <h2 className="text-ink text-xl font-semibold tracking-tight">{record.solver}</h2>
                <div className="text-ink-3 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  {record.country && <span className="uppercase">{record.country}</span>}
                  {record.source && <span className="capitalize">{record.source}</span>}
                  <span className="nums text-ink-2">#{record.id}</span>
                  {record.compWcaId && (
                    <a
                      href={`https://www.worldcubeassociation.org/competitions/${record.compWcaId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-3 hover:text-ink flex items-center gap-1 transition-colors"
                    >
                      <Trophy className="size-3" /> wca
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            {actions}
          </div>

          {/* Meta strip: puzzle · method · competition · date · solve · record */}
          <div className="text-ink-3 mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="text-ink-2 font-medium">{record.puzzle}</span>
            <span className="text-ink-2 font-medium">{record.method}</span>
            <span className="truncate">{record.competition || '—'}</span>
            {dateDisplay !== '—' && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" /> {dateDisplay}
              </span>
            )}
            {record.solveNum != null && <span>{t('detail.solveNum', { count: record.solveNum })}</span>}
            {record.reconstructor && (
              <span className="flex items-center gap-1">
                <UserRound className="size-3" />
                {t('detail.reconBy', { name: record.reconstructor })}
              </span>
            )}
            {record.record && (
              <span className="text-plus2 font-semibold uppercase">{record.record}</span>
            )}
          </div>
        </div>
      </header>

        {/* ── Replay anchors left · rest scrolls right ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Replay — fills remaining height on lg (no scroll), stacks on smaller */}
          {solve && (
            <div className="flex min-h-0 w-full flex-col lg:w-3/5 lg:min-w-[26rem] lg:max-w-[50rem] lg:flex-none lg:border-r lg:border-line/60">
              <div className="flex aspect-[5/4] w-full min-h-0 flex-col p-4 sm:p-5 lg:aspect-auto lg:h-full lg:flex-1">
                <ReplaySection
                  ref={replayRef}
                  solve={solve}
                  size="large"
                  collapsible={false}
                  className="h-full w-full min-h-0 border-0 p-0 bg-transparent shadow-none"
                />
              </div>
            </div>
          )}

          {/* Right — scrollable content list */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:w-2/5 lg:flex-1">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:px-5">
              {/* Scramble */}
            {record.scramble && (
              <div className="border-line bg-surface rounded-lg border px-4 py-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-ink-3 text-[0.56rem] font-semibold tracking-wider uppercase">
                    {t('detail.scramble')}
                  </span>
                  {stm != null && (
                    <span className="nums text-ink-3 text-[0.6rem]">
                      {t('detail.stm', { count: stm })}
                    </span>
                  )}
                </div>
                <p className="text-ink-2 font-mono text-[0.7rem] leading-relaxed break-words">
                  {record.scramble}
                </p>
              </div>
            )}

            {/* Stats — tile grid below the scramble */}
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              <MetricTile label={t('detail.chipStm')} value={stm != null ? String(stm) : '—'} />
              <MetricTile label={t('detail.chipTps')} value={tps != null ? tps.toFixed(2) : '—'} />
              <MetricTile
                label={t('detail.chipCrossStm')}
                value={record.stats.crossStm != null ? String(record.stats.crossStm) : '—'}
              />
              <MetricTile
                label={t('detail.chipF2l')}
                value={record.stats.f2l != null ? String(record.stats.f2l) : '—'}
              />
              <MetricTile
                label={t('detail.chipLl')}
                value={record.stats.ll != null ? String(record.stats.ll) : '—'}
              />
              <MetricTile
                label={t('detail.chipRotations')}
                value={String(record.rotationCount ?? 0)}
              />
              {record.average != null && (
                <MetricTile label={t('detail.chipAvg')} value={formatTime(record.average * 1000)} />
              )}
              {record.cube && <MetricTile label={t('detail.chipCube')} value={record.cube} />}
            </div>

            {/* Our detection — replaces the hardcoded steps for CFOP 3×3 */}
            <OurDetectionPanel
              record={record}
              onSeekToMove={(moveIndex) => void replayRef.current?.seekToMove(moveIndex)}
            />

            {/* Reconstructor's raw phases — only when OUR detection is absent */}
            {showRawPhases && <RawPhasesTable record={record} />}

            {/* Raw solution text */}
            {record.text && (
              <div className="border-line bg-surface rounded-lg border px-4 py-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-ink-3 text-[0.56rem] font-semibold tracking-wider uppercase">
                    {t('detail.reconEyebrow')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="text-ink-3 hover:text-ink h-6 gap-1 px-2 text-xs"
                  >
                    {copied ? <Check className="text-ready size-3" /> : <Copy className="size-3" />}
                    {copied ? t('detail.copied') : t('detail.copy')}
                  </Button>
                </div>
                <pre className="text-ink-2 max-h-72 overflow-y-auto font-mono text-[0.7rem] leading-relaxed break-words whitespace-pre-wrap">
                  {record.text}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
