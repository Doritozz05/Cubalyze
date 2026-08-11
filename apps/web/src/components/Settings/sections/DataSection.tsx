'use client';

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Download, FileJson, FileSpreadsheet, Upload, FileUp, AlertTriangle, Check, X, Brain, FileText, Grid3x3, ArrowLeft } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useStorageStatusStore } from '@/stores/storageStatus';
import { exportSolvesToCSV, exportSolvesToCsTimer, exportSolvesToXLSX, downloadFile } from '@/utils/exportSolves';
import { previewImport, parseImport, readFileAsText, toSolveInput, type ImportPreview } from '@/utils/importSolves';
import { PUZZLE_CATEGORIES, puzzleCategoryToType } from '@/utils/puzzleUtils';
import type { Solve, PuzzleCategory } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TOUCH_FULL_BLEED } from '@/lib/touch';

export interface DataSectionProps {
  solves: Solve[];
  sessionName?: string;
  /** Batch import callback — adds multiple solves at once. */
  onImportSolves?: (solves: ReturnType<typeof toSolveInput>[]) => Promise<void>;
  /** Export a JSON file containing every session's solves (full fidelity). */
  onExportAllJSON?: () => Promise<void>;
}

/**
 * Data management settings section.
 *
 * Provides:
 * - CSV export (CubeForge format)
 * - csTimer-compatible CSV export (semicolon delimited)
 * - JSON export (full metadata)
 * - Import from csTimer / CubeForge / generic CSV with preview
 */
const FORMAT_NAME_KEY: Record<string, ParseKeys<'settings'>> = {
  cstimer: 'data.formatNameCstimer',
  'cstimer-json': 'data.formatNameCstimer',
  twistytimer: 'data.formatNameTwisty',
  'cubeforge-csv': 'data.formatNameCubeforgeCsv',
  'cubeforge-json': 'data.formatNameCubeforgeJson',
  generic: 'data.formatNameGeneric',
};

export const DataSection = memo(function DataSection({ solves, sessionName, onImportSolves, onExportAllJSON }: DataSectionProps) {
  const { t } = useTranslation('settings');
  const [importOpen, setImportOpen] = useState(false);
  const [importState, setImportState] = useState<'idle' | 'preview' | 'importing' | 'done' | 'error'>('idle');
  // 'category': legacy flow — user picks 2x2/3x3/etc and ALL solves are forced
  // into that category. 'json': full-fidelity CubeForge JSON flow — per-solve
  // puzzleType (and every other field) is preserved as-is.
  const [importMode, setImportMode] = useState<'category' | 'json'>('category');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // Puzzle category selected before importing — solves are stored into it.
  // Only used in 'category' mode; ignored in 'json' mode.
  const [importCategory, setImportCategory] = useState<PuzzleCategory | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Store the original file content so handleConfirmImport can parse the
  // full data (rawLines is truncated for preview).
  const fileContentRef = useRef<string>('');

  const isEmpty = solves.length === 0;
  // Volatile (in-memory) storage means all data is wiped on reload — show a
  // persistent warning here so the user knows to export regularly.
  const storageType = useStorageStatusStore((s) => s.storageType);
  const volatileStorage = storageType === 'memory';

  // ── Reset import state on close ──────────────────────────────────────
  useEffect(() => {
    if (!importOpen) {
      // Delay reset so exit animation completes
      const t = setTimeout(() => {
        setImportState('idle');
        setImportPreview(null);
        setImportResult(null);
        setImportError(null);
        setDragOver(false);
        setImportCategory(null);
        setImportMode('category');
        fileContentRef.current = '';
      }, 200);
      return () => clearTimeout(t);
    }
  }, [importOpen]);

  // ── File handling ────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    try {
      const content = await readFileAsText(file);
      const preview = previewImport(content);

      if (preview.rowCount === 0 && preview.errorCount > 0) {
        setImportError(t('data.parseError'));
        setImportState('error');
        return;
      }

      fileContentRef.current = content;
      setImportPreview(preview);
      setImportState('preview');
      setImportError(null);
    } catch (e) {
      setImportError(
        t('data.readError', {
          message: e instanceof Error ? e.message : String(e),
        }),
      );
      setImportState('error');
    }
    // t is stable across renders — only the resolved value changes with locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  // ── Import execution ─────────────────────────────────────────────────
  const handleConfirmImport = useCallback(async () => {
    if (!importPreview || !onImportSolves) return;

    setImportState('importing');
    try {
      const result = parseImport(fileContentRef.current);

      let inputs: ReturnType<typeof toSolveInput>[];
      if (importMode === 'json') {
        // Full-fidelity path: CubeForge JSON — keep the per-solve puzzleType
        // (and everything else) exactly as exported. Never force a category.
        if (importPreview.format !== 'cubeforge-json') {
          setImportError(t('data.notJsonError'));
          setImportState('error');
          return;
        }
        inputs = result.solves.map((s) => toSolveInput(s));
      } else {
        // Legacy path: force the user-selected category so solves always
        // land where the user picked — never rely on puzzle inference.
        const puzzleType = importCategory ? puzzleCategoryToType(importCategory) : undefined;
        inputs = result.solves.map((s) =>
          toSolveInput(puzzleType ? { ...s, puzzleType } : s),
        );
      }

      await onImportSolves(inputs);

      setImportResult({
        imported: result.solves.length,
        errors: result.errors.length,
      });
      setImportState('done');
    } catch (e) {
      setImportError(
        t('data.importError', {
          message: e instanceof Error ? e.message : String(e),
        }),
      );
      setImportState('error');
    }
  }, [importPreview, onImportSolves, importCategory, importMode, t]);

  // ── Export handlers ──────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (solves.length === 0) return;
    const csv = exportSolvesToCSV(solves, sessionName);
    const name = (sessionName ?? 'session').replace(/[^a-z0-9_-]/gi, '_');
    downloadFile(csv, `cubeforge-${name}.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportCsTimer = () => {
    if (solves.length === 0) return;
    const csv = exportSolvesToCsTimer(solves);
    const name = (sessionName ?? 'session').replace(/[^a-z0-9_-]/gi, '_');
    downloadFile(csv, `cubeforge-${name}-cstimer.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportAllJSON = useCallback(() => {
    if (!onExportAllJSON || exportingAll) return;
    setExportingAll(true);
    onExportAllJSON()
      .catch(() => toast.error(i18n.t('toast:exportSessionsFailed')))
      .finally(() => setExportingAll(false));
  }, [onExportAllJSON, exportingAll]);

  const handleExportExcel = () => {
    if (solves.length === 0 || exportingExcel) return;
    // SheetJS is loaded on demand — only pay for it when exporting.
    setExportingExcel(true);
    exportSolvesToXLSX(solves, sessionName ?? 'session')
      .catch(() => {
        toast.error(i18n.t('toast:excelExportFailed'));
      })
      .finally(() => setExportingExcel(false));
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        {volatileStorage && (
          <div className="flex items-start gap-3 rounded-xl border border-dnf/30 bg-dnf/5 p-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dnf/20 bg-surface">
              <AlertTriangle className="size-4 text-dnf" />
            </div>
            <div className="min-w-0">
              <p className="text-[0.82rem] font-medium text-ink">{t('data.volatileTitle')}</p>
              <p className="mt-1 text-[0.72rem] text-ink-2 leading-relaxed">
                {t('data.volatileHint')}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
            <Download className="size-4 text-ink-2" />
          </div>
          <p className="text-[0.82rem] text-ink-2">{t('data.header')}</p>
        </div>

        {/* ── Import ─────────────────────────────────────────────────── */}
        <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Upload className="size-4 text-ink-2" />
              <h4 className="text-[0.85rem] font-medium text-ink">{t('data.importSolves')}</h4>
            </div>
            <p className="mt-1.5 text-[0.72rem] text-ink-3">
              {t('data.importHint')}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button
              onClick={() => { setImportOpen(true); setImportState('idle'); setImportCategory(null); setImportMode('category'); }}
              disabled={!onImportSolves}
              className="rounded-lg border border-line bg-surface-2/50 max-lg:min-h-11 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-surface-2 hover:border-ink/20 cursor-pointer"
            >
              {t('data.importData')}
            </button>
            <button
              onClick={() => { setImportOpen(true); setImportState('idle'); setImportCategory(null); setImportMode('json'); }}
              disabled={!onImportSolves}
              className="rounded-lg border border-phase-indigo/25 bg-phase-indigo/5 max-lg:min-h-11 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-phase-indigo/10 hover:border-phase-indigo/40 cursor-pointer"
            >
              {t('data.importJson')}{' '}
              <span className="text-phase-indigo text-[0.7rem] font-normal">
                {t('data.noDataLoss')}
              </span>
            </button>
          </div>
        </div>

        {/* ── CubeForge CSV ─────────────────────────────────────────── */}
        <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-ink-2" />
              <h4 className="text-[0.85rem] font-medium text-ink">{t('data.csvTitle')}</h4>
            </div>
            <p className="mt-1.5 text-[0.72rem] text-ink-3">
              {t('data.csvHint')}
            </p>
            {isEmpty && (
              <p className="mt-1 text-[0.62rem] text-ink-3/60">{t('data.noSolves')}</p>
            )}
          </div>
          <button
            onClick={handleExportCSV}
            disabled={isEmpty}
            className="shrink-0 rounded-lg border border-line bg-surface-2/50 max-lg:min-h-11 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-surface-2 hover:border-ink/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('data.exportCsv')}
          </button>
        </div>

        {/* ── csTimer CSV ───────────────────────────────────────────── */}
        <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-ink-2" />
              <h4 className="text-[0.85rem] font-medium text-ink">{t('data.cstimerTitle')}</h4>
              <span className="rounded-full border border-caution/30 bg-caution/10 px-2 py-0.5 text-[0.58rem] font-medium text-caution">
                {t('data.recommended')}
              </span>
            </div>
            <p className="mt-1.5 text-[0.72rem] text-ink-3">
              {t('data.cstimerHint')}
            </p>
            {isEmpty && (
              <p className="mt-1 text-[0.62rem] text-ink-3/60">{t('data.noSolves')}</p>
            )}
          </div>
          <button
            onClick={handleExportCsTimer}
            disabled={isEmpty}
            className="shrink-0 rounded-lg border border-line bg-surface-2/50 max-lg:min-h-11 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-surface-2 hover:border-ink/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('data.exportCstimer')}
          </button>
        </div>

        {/* ── Export ALL sessions (JSON) ───────────────────────────── */}
        <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileJson className="size-4 text-ink-2" />
              <h4 className="text-[0.85rem] font-medium text-ink">{t('data.exportAllTitle')}</h4>
              <span className="rounded-full border border-phase-indigo/30 bg-phase-indigo/10 px-2 py-0.5 text-[0.58rem] font-medium text-phase-indigo">
                {t('data.noDataLossBadge')}
              </span>
            </div>
            <p className="mt-1.5 text-[0.72rem] text-ink-3">
              {t('data.exportAllHint')}
            </p>
          </div>
          <button
            onClick={handleExportAllJSON}
            disabled={!onExportAllJSON || exportingAll}
            className="shrink-0 rounded-lg border border-line bg-surface-2/50 max-lg:min-h-11 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-surface-2 hover:border-ink/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exportingAll ? t('data.exporting') : t('data.exportAll')}
          </button>
        </div>

        {/* ── Excel Export ──────────────────────────────────────────── */}
        <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-ink-2" />
              <h4 className="text-[0.85rem] font-medium text-ink">{t('data.excelTitle')}</h4>
            </div>
            <p className="mt-1.5 text-[0.72rem] text-ink-3">
              {t('data.excelHint')}
            </p>
            {isEmpty && (
              <p className="mt-1 text-[0.62rem] text-ink-3/60">{t('data.noSolves')}</p>
            )}
          </div>
          <button
            onClick={handleExportExcel}
            disabled={isEmpty || exportingExcel}
            className="shrink-0 rounded-lg border border-line bg-surface-2/50 max-lg:min-h-11 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-surface-2 hover:border-ink/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exportingExcel ? t('data.exporting') : t('data.exportExcel')}
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-line/30 bg-surface-2/30 p-3">
          <span className="text-[0.65rem] text-ink-2 leading-relaxed">
            {t('data.footer')}
          </span>
        </div>
      </div>

      {/* ── Import Dialog ──────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) { setImportOpen(false); if (importState === 'done') window.location.reload(); } }}>
        <DialogContent className={`sm:max-w-lg overflow-hidden p-0 gap-0 ${TOUCH_FULL_BLEED} max-lg:pb-safe`} showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>{t('data.importSolves')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col max-h-[75vh]">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-md bg-ink text-surface">
                  {importState === 'done' ? <Check className="size-3.5" /> : importState === 'importing' ? <Spinner size="xs" /> : <Upload className="size-3.5" />}
                </div>
                <span className="text-sm font-medium text-ink">
                  {importState === 'idle'
                    ? t('data.importSolves')
                    : importState === 'preview'
                      ? t('data.previewImport')
                      : importState === 'importing'
                        ? t('data.importing')
                        : importState === 'done'
                          ? t('data.importComplete')
                          : t('data.importFailed')}
                </span>
              </div>
              <button
                onClick={() => setImportOpen(false)}
                className="grid size-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-5">
              {importState === 'idle' && (
                <div className="flex flex-col gap-5">
                  {importMode === 'json' ? (
                    /* ── Full-fidelity CubeForge JSON flow (no category) ── */
                    <>
                      <div className="flex items-start gap-3 rounded-lg border border-phase-indigo/25 bg-phase-indigo/5 p-3">
                        <Check className="mt-0.5 size-4 shrink-0 text-phase-indigo" />
                        <div>
                          <p className="text-[0.72rem] font-medium text-ink flex items-center gap-2">
                            {t('data.importJson')}{' '}
                            <span className="rounded-full border border-phase-indigo/30 bg-phase-indigo/10 px-1.5 py-0.5 text-[0.58rem] font-medium text-phase-indigo">
                              {t('data.noDataLossBadge')}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[0.62rem] text-ink-3 leading-relaxed">
                            {t('data.jsonBadgeNote')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setImportMode('category')}
                        className="flex w-fit items-center gap-1 rounded-md px-2 py-1 text-[0.62rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink cursor-pointer"
                      >
                        <ArrowLeft className="size-3" />
                        {t('data.useCategoryImport')}
                      </button>

                      <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-6 transition-colors cursor-pointer',
                          dragOver
                            ? 'border-ink bg-surface-2'
                            : 'border-line hover:border-ink/30 hover:bg-surface-2/50',
                        )}
                      >
                        <div className="grid size-12 place-items-center rounded-full bg-surface-2">
                          <FileUp className={cn('size-5', dragOver ? 'text-ink' : 'text-ink-3/50')} />
                        </div>
                        <div className="text-center">
                          <p className="text-[0.78rem] font-medium text-ink">
                            {t('data.dropJson')}
                          </p>
                          <p className="mt-1 text-[0.65rem] text-ink-3">
                            {t('data.dropJsonHint')}
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>
                    </>
                  ) : !importCategory ? (
                    /* ── Step 1: pick the puzzle category ──────────────── */
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2">
                          <Grid3x3 className="size-4 text-ink-2" />
                        </div>
                        <div>
                          <p className="text-[0.8rem] font-medium text-ink">{t('data.chooseCategory')}</p>
                          <p className="text-[0.62rem] text-ink-3">{t('data.chooseCategoryHint')}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {PUZZLE_CATEGORIES.map((c) => (
                          <button
                            key={c}
                            onClick={() => setImportCategory(c)}
                            className="rounded-lg border border-line bg-surface-2/40 px-2 py-2.5 text-[0.7rem] font-medium text-ink transition-all hover:border-ink/40 hover:bg-surface-2 cursor-pointer"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* ── Step 2: drop zone for the chosen category ─────── */
                    <>
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Grid3x3 className="size-3.5 shrink-0 text-ink-2" />
                          <p className="truncate text-[0.7rem] text-ink">
                            {t('data.importingInto', { category: importCategory })}
                          </p>
                        </div>
                        <button
                          onClick={() => setImportCategory(null)}
                          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[0.62rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink cursor-pointer"
                        >
                          <ArrowLeft className="size-3" />
                          {t('data.change')}
                        </button>
                      </div>

                      <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-6 transition-colors cursor-pointer',
                          dragOver
                            ? 'border-ink bg-ink/5'
                            : 'border-line hover:border-ink/30 hover:bg-surface-2/50',
                        )}
                      >
                        <div className="grid size-12 place-items-center rounded-full bg-surface-2">
                          <FileUp className={cn('size-5', dragOver ? 'text-ink' : 'text-ink-3/50')} />
                        </div>
                        <div className="text-center">
                          <p className="text-[0.78rem] font-medium text-ink">
                            {t('data.dropFile')}
                          </p>
                          <p className="mt-1 text-[0.65rem] text-ink-3">
                            {t('data.dropFileHint')}
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.txt,.json,.tsv"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border border-line/30 bg-surface-2/30 p-3">
                        <FileText className="size-3.5 text-ink-3/50 shrink-0" />
                        <div className="text-[0.62rem] text-ink-3 leading-relaxed">
                          <strong>{t('data.formatCstimer')}</strong>{' '}
                          <code className="text-[0.58rem] bg-ink/5 px-1 rounded">&quot;333&quot;;&quot;Normal&quot;;&quot;12217&quot;;&quot;1620000000&quot;;&quot;R U R'&quot;;&quot;0&quot;;&quot;&quot;</code>
                          <br />
                          <strong>{t('data.formatNewerCstimer')}</strong>{' '}
                          <code className="text-[0.58rem] bg-ink/5 px-1 rounded">No.;Time;Comment;Scramble;Date;P.1</code>
                          <br />
                          <strong>{t('data.formatTwisty')}</strong>{' '}
                          <code className="text-[0.58rem] bg-ink/5 px-1 rounded">&quot;54.03&quot;;&quot;R U R'&quot;;&quot;2025-01-08T19:50:06+01:00&quot;</code>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {importState === 'preview' && importPreview && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/60 p-3">
                    <Check className="size-4 text-ink-2 shrink-0" />
                    <div>
                      <p className="text-[0.72rem] font-medium text-ink">
                        {t('data.detected', {
                          format: t(FORMAT_NAME_KEY[importPreview.format]),
                        })}
                        {importCategory && (
                          <span className="text-ink-2">
                            {t('data.into', { category: importCategory })}
                          </span>
                        )}
                      </p>
                      <p className="text-[0.62rem] text-ink-3 mt-0.5">
                        {t('data.solvesFound', { count: importPreview.rowCount })}
                        {importPreview.errorCount > 0 &&
                          t('data.errorsFound', { count: importPreview.errorCount })}
                      </p>
                    </div>
                  </div>

                  {/* Preview table */}
                  {importPreview.samples.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-line">
                      <table className="w-full text-left text-[0.65rem]">
                        <thead>
                          <tr className="border-b border-line bg-surface-2">
                            <th className="px-3 py-2 font-medium text-ink-2 whitespace-nowrap">{t('data.colTime')}</th>
                            <th className="px-3 py-2 font-medium text-ink-2 whitespace-nowrap">{t('data.colPenalty')}</th>
                            <th className="px-3 py-2 font-medium text-ink-2 whitespace-nowrap">{t('data.colScramble')}</th>
                            <th className="px-3 py-2 font-medium text-ink-2 whitespace-nowrap">{t('data.colDate')}</th>
                            <th className="px-3 py-2 font-medium text-ink-2 whitespace-nowrap">{t('data.colNote')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.samples.map((s, i) => (
                            <tr key={`${s.timestamp}-${s.time}-${i}`} className="border-b border-line/50 last:border-0">
                              <td className="px-3 py-2 text-ink font-mono">
                                {s.penalty === 'DNF'
                                  ? s.time > 0
                                    ? `DNF(${(s.time / 1000).toFixed(2)})`
                                    : 'DNF'
                                  : `${(s.time / 1000).toFixed(2)}s${s.penalty === '+2' ? '+' : ''}`}
                              </td>
                              <td className="px-3 py-2">{s.penalty}</td>
                              <td className="px-3 py-2 text-ink-3 font-mono max-w-30 truncate">{s.scramble}</td>
                              <td className="px-3 py-2 text-ink-3 whitespace-nowrap">{new Date(s.timestamp).toLocaleDateString()}</td>
                              <td className="px-3 py-2 text-ink-3">{s.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setImportState('idle'); setImportPreview(null); }}
                      className="rounded-md border border-line px-3 py-1.5 text-[0.68rem] text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      {t('data.cancel')}
                    </button>
                    <button
                      onClick={() => void handleConfirmImport()}
                      disabled={importMode === 'category' && !importCategory}
                      className="rounded-md bg-ink px-4 py-1.5 text-[0.68rem] font-medium text-surface hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {importMode === 'json'
                        ? t('data.importCountJson', { count: importPreview.rowCount })
                        : t('data.importCountInto', {
                            count: importPreview.rowCount,
                            category: importCategory ?? '',
                          })}
                    </button>
                  </div>
                </div>
              )}

              {importState === 'importing' && (
                <Spinner variant="centered" size="md" label={t('data.importingLabel')} />
              )}

              {importState === 'done' && importResult && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="grid size-14 place-items-center rounded-full bg-ready/10">
                    <Check className="size-6 text-ready" />
                  </div>
                  <div className="text-center">
                    <p className="text-[0.85rem] font-semibold text-ink">
                      {t('data.importedCount', { count: importResult.imported })}
                    </p>
                    {importResult.errors > 0 && (
                      <p className="text-[0.65rem] text-ink-3 mt-1">
                        {t('data.skippedCount', { count: importResult.errors })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setImportOpen(false)}
                    className="rounded-lg border border-line px-4 py-2 text-[0.72rem] font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    {t('data.done')}
                  </button>
                </div>
              )}

              {importState === 'error' && importError && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="grid size-14 place-items-center rounded-full bg-dnf/10">
                    <AlertTriangle className="size-6 text-dnf" />
                  </div>
                  <div className="text-center max-w-xs">
                    <p className="text-[0.82rem] font-semibold text-ink">{t('data.importFailed')}</p>
                    <p className="text-[0.65rem] text-ink-3 mt-1">{importError}</p>
                  </div>
                  <button
                    onClick={() => { setImportState('idle'); setImportError(null); }}
                    className="rounded-lg border border-line px-4 py-2 text-[0.72rem] font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    {t('data.tryAgain')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
