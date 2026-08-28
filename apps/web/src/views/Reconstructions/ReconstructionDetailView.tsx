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
  Columns2,
  Rows2,
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
      <div className="border-line flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2.5 sm:px-4 sm:py-3">
        <SectionHeader title={t('detail.stepsTitle')} eyebrow={t('detail.stepsEyebrow')} />
        <span className="nums text-ink-3 text-xs">
          {t('detail.movesCount', {
            count: record.phases.reduce((n, p) => n + p.moveCount, 0),
          })}
        </span>
      </div>
      <div className="overflow-x-auto overflow-y-hidden min-w-0">
        <div className="grid min-w-[24rem] sm:min-w-0 grid-cols-[5.5rem_minmax(4.5rem,max-content)_1fr_2.25rem] sm:grid-cols-[6.5rem_minmax(5rem,max-content)_1fr_2.5rem] xl:grid-cols-[7.5rem_minmax(5.5rem,max-content)_1fr_2.75rem]">
          <div className="border-line bg-surface-2/50 text-ink-3 col-span-4 grid grid-cols-subgrid items-center gap-2 sm:gap-3 border-b px-3 py-1.5 text-[0.56rem] font-semibold tracking-wider uppercase">
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
  const { t } = useTranslation('reconstructions');
  const [record, setRecord] = useState<ReconFullRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isStacked, setIsStacked] = useState(false);

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
      await navigator.clipboard.writeText(record.text || record.scramble || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [record]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-ink text-sm font-medium">{error}</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" /> {t('detail.back')}
        </Button>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 border-b border-line bg-surface/40 px-4 py-3 sm:px-6">
          <Skeleton className="h-4 w-20" />
          <div className="mt-3 flex items-end justify-between">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row">
          <Skeleton className="h-72 w-full lg:h-full lg:w-3/5" />
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
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
      {/* Toggle between Split (side-by-side) and Stacked (vertical / mobile-like) mode on PC and tablet */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsStacked((v) => !v)}
        title={isStacked ? t('detail.layoutSplit') : t('detail.layoutStacked')}
        aria-label={isStacked ? t('detail.layoutSplit') : t('detail.layoutStacked')}
        className="text-ink-3 hover:text-ink hidden sm:inline-flex h-7 sm:h-8 gap-1.5 px-2 sm:px-2.5 text-xs"
      >
        {isStacked ? <Columns2 className="size-3.5" /> : <Rows2 className="size-3.5" />}
        <span className="hidden md:inline">
          {isStacked ? t('detail.layoutSplit') : t('detail.layoutStacked')}
        </span>
      </Button>

      {record.url && (
        <a
          href={record.url}
          target="_blank"
          rel="noreferrer"
          className="text-ink-3 hover:bg-surface-2 hover:text-ink flex items-center gap-1.5 rounded-md px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-colors"
        >
          <ExternalLink className="size-3.5" /> {t('detail.source')}
        </a>
      )}
      {record.stats.videoUrl && (
        <a
          href={record.stats.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-ink-3 hover:bg-surface-2 hover:text-ink flex items-center gap-1.5 rounded-md px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-colors"
        >
          <Video className="size-3.5" /> {t('detail.video')}
        </a>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="text-ink-3 hover:text-ink h-7 sm:h-8 gap-1.5 px-2 sm:px-2.5 text-xs"
      >
        {copied ? <Check className="text-ready size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? t('detail.copied') : t('detail.copy')}
      </Button>
    </div>
  );

  const contentList = (
    <>
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
          <p className="text-ink-2 font-mono text-[0.7rem] leading-relaxed wrap-break-word">
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
          <pre className="text-ink-2 max-h-72 overflow-y-auto font-mono text-[0.7rem] leading-relaxed wrap-break-word whitespace-pre-wrap">
            {record.text}
          </pre>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ── Header: identity + context, compact & responsive ── */}
      <header className="shrink-0 border-b border-line bg-surface/40 px-4 py-2.5 sm:px-5 sm:py-3 lg:px-6 lg:py-3">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="text-ink-3 hover:text-ink flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" /> {t('detail.back')}
          </button>
        </div>

        <div className="mt-1.5 sm:mt-2">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            {/* Time + solver + provenance */}
            <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-1.5 sm:gap-x-6">
              <div className="nums text-ink text-3xl sm:text-4xl lg:text-5xl leading-none font-semibold tracking-tight tabular-nums">
                {record.time > 0 ? formatTime(record.time * 1000) : '—'}
              </div>
              <div className="min-w-0 pb-0.5">
                <h2 className="text-ink text-base sm:text-lg lg:text-xl font-semibold tracking-tight">{record.solver}</h2>
                <div className="text-ink-3 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.7rem] sm:text-xs">
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
          <div className="text-ink-3 mt-1.5 sm:mt-2 flex flex-wrap items-center gap-x-2 sm:gap-x-2.5 gap-y-0.5 text-[0.7rem] sm:text-xs">
            <span className="text-ink-2 font-medium">{record.puzzle}</span>
            <span className="text-ink-2 font-medium">{record.method}</span>
            <span className="truncate max-w-48 sm:max-w-none">{record.competition || '—'}</span>
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

      {/* ── Main Layout: Stacked (mobile-style or user preference) vs Desktop Split (side-by-side) ── */}
      {isStacked ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-5">
            {solve && (
              <div className="flex flex-col aspect-4/3 sm:aspect-16/10 lg:aspect-video w-full min-h-75 sm:min-h-95 max-h-130 rounded-xl border border-line bg-surface p-3 sm:p-4 shadow-xs">
                <ReplaySection
                  ref={replayRef}
                  solve={solve}
                  size="large"
                  collapsible={false}
                  showHeader={false}
                  className="h-full w-full min-h-0 border-0 p-0 bg-transparent shadow-none"
                />
              </div>
            )}
            {contentList}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden lg:flex-row">
          {/* Replay — on mobile (< lg), scrolls in document flow with the content list; on desktop (lg+), sticky split column */}
          {solve && (
            <div className="w-full shrink-0 max-lg:px-3 max-lg:pt-4 max-lg:pb-1 max-w-4xl mx-auto lg:mx-0 lg:h-full lg:w-[48%] xl:w-7/12 lg:min-w-72 lg:max-w-200 lg:flex-none lg:border-r lg:border-line/60">
              <div className="flex flex-col aspect-4/3 sm:aspect-16/10 lg:aspect-auto w-full min-h-75 sm:min-h-95 lg:min-h-0 lg:h-full rounded-xl border border-line bg-surface p-3 sm:p-4 lg:rounded-none lg:border-0 lg:bg-transparent shadow-xs lg:shadow-none">
                <ReplaySection
                  ref={replayRef}
                  solve={solve}
                  size="large"
                  collapsible={false}
                  showHeader={false}
                  className="h-full w-full min-h-0 border-0 p-0 bg-transparent shadow-none"
                />
              </div>
            </div>
          )}

          {/* Right — content list: on mobile (< lg), flows seamlessly in the same scroll container; on desktop (lg+), scrolls independently */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:overflow-y-auto lg:w-[52%] xl:w-5/12">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5">
              {contentList}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
