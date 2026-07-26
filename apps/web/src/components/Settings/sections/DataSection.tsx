'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Download, FileJson, FileSpreadsheet, Upload, FileUp, AlertTriangle, Check, X, Loader2, Brain, FileText } from 'lucide-react';
import { exportSolvesToCSV, exportSolvesToCsTimer, exportSolvesToJSON, downloadFile } from '@/utils/exportSolves';
import { previewImport, parseImport, readFileAsText, toSolveInput, type ImportPreview } from '@/utils/importSolves';
import type { Solve } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface DataSectionProps {
  solves: Solve[];
  sessionName?: string;
  /** Batch import callback — adds multiple solves at once. */
  onImportSolves?: (solves: ReturnType<typeof toSolveInput>[]) => Promise<void>;
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
export function DataSection({ solves, sessionName, onImportSolves }: DataSectionProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [importState, setImportState] = useState<'idle' | 'preview' | 'importing' | 'done' | 'error'>('idle');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEmpty = solves.length === 0;

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
        setImportError('Could not parse any solves from this file. Check the format and try again.');
        setImportState('error');
        return;
      }

      setImportPreview(preview);
      setImportState('preview');
      setImportError(null);
    } catch (e) {
      setImportError('Failed to read file: ' + (e instanceof Error ? e.message : String(e)));
      setImportState('error');
    }
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
      const content = await readFileAsText(
        new File([importPreview.rawLines.join('\n')], 'import', { type: 'text/plain' }),
      );
      const result = parseImport(content);
      const inputs = result.solves.map(toSolveInput);
      await onImportSolves(inputs);

      setImportResult({
        imported: result.solves.length,
        errors: result.errors.length,
      });
      setImportState('done');
    } catch (e) {
      setImportError('Import failed: ' + (e instanceof Error ? e.message : String(e)));
      setImportState('error');
    }
  }, [importPreview, onImportSolves]);

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

  const handleExportJSON = () => {
    if (solves.length === 0) return;
    const json = exportSolvesToJSON(solves, sessionName);
    const name = (sessionName ?? 'session').replace(/[^a-z0-9_-]/gi, '_');
    downloadFile(json, `cubeforge-${name}.json`, 'application/json');
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
            <Download className="size-4 text-ink-2" />
          </div>
          <p className="text-[0.82rem] text-ink-2">
            Export your solve data to standard formats or import from csTimer, Twisty Timer, and other cubing apps.
          </p>
        </div>

        {/* ── Import ─────────────────────────────────────────────────── */}
        <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Upload className="size-4 text-ink-2" />
              <h4 className="text-[0.85rem] font-medium text-ink">Import solves</h4>
            </div>
            <p className="mt-1.5 text-[0.72rem] text-ink-3">
              Import from csTimer, Twisty Timer, CubeDesk, or any CSV file.
            </p>
          </div>
          <button
            onClick={() => { setImportOpen(true); setImportState('idle'); }}
            disabled={!onImportSolves}
            className="shrink-0 rounded-lg border border-line bg-surface-2/50 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-surface-2 hover:border-ink/20 cursor-pointer"
          >
            Import data
          </button>
        </div>

        {/* ── CubeForge CSV ─────────────────────────────────────────── */}
        <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-ink-2" />
              <h4 className="text-[0.85rem] font-medium text-ink">CubeForge CSV</h4>
            </div>
            <p className="mt-1.5 text-[0.72rem] text-ink-3">
              Standard spreadsheet format. Times in seconds, ISO dates. Good for Excel / Google Sheets.
            </p>
            {isEmpty && (
              <p className="mt-1 text-[0.62rem] text-ink-3/60">No solves to export yet.</p>
            )}
          </div>
          <button
            onClick={handleExportCSV}
            disabled={isEmpty}
            className="shrink-0 rounded-lg border border-line bg-surface-2/50 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-surface-2 hover:border-ink/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>

        {/* ── csTimer CSV ───────────────────────────────────────────── */}
        <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-ink-2" />
              <h4 className="text-[0.85rem] font-medium text-ink">csTimer format</h4>
              <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[0.58rem] font-medium text-amber-500">Recommended</span>
            </div>
            <p className="mt-1.5 text-[0.72rem] text-ink-3">
              Semicolon-delimited format natively importable by csTimer, Twisty Timer, and most cubing apps. Times in milliseconds, epoch dates.
            </p>
            {isEmpty && (
              <p className="mt-1 text-[0.62rem] text-ink-3/60">No solves to export yet.</p>
            )}
          </div>
          <button
            onClick={handleExportCsTimer}
            disabled={isEmpty}
            className="shrink-0 rounded-lg border border-line bg-surface-2/50 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-surface-2 hover:border-ink/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export csTimer
          </button>
        </div>

        {/* ── JSON Export ───────────────────────────────────────────── */}
        <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileJson className="size-4 text-ink-2" />
              <h4 className="text-[0.85rem] font-medium text-ink">JSON export</h4>
            </div>
            <p className="mt-1.5 text-[0.72rem] text-ink-3">
              Full machine-readable export with all solve metadata. Re-importable to CubeForge with no data loss.
            </p>
            {isEmpty && (
              <p className="mt-1 text-[0.62rem] text-ink-3/60">No solves to export yet.</p>
            )}
          </div>
          <button
            onClick={handleExportJSON}
            disabled={isEmpty}
            className="shrink-0 rounded-lg border border-line bg-surface-2/50 px-4 py-2 text-[0.75rem] font-medium text-ink transition-all hover:bg-surface-2 hover:border-ink/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export JSON
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-line/30 bg-surface-2/30 p-3">
          <span className="text-[0.65rem] text-ink-2 leading-relaxed">
            Exports include time, penalty, scramble, method, date, and notes. Use <strong>csTimer format</strong> for maximum compatibility — it works with csTimer, Twisty Timer, CubeDesk, and most cubing apps.
          </span>
        </div>
      </div>

      {/* ── Import Dialog ──────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) { setImportOpen(false); if (importState === 'done') window.location.reload(); } }}>
        <DialogContent className="sm:max-w-lg overflow-hidden p-0 gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Import solves</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col max-h-[75vh]">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-surface">
                  {importState === 'done' ? <Check className="size-3.5" /> : importState === 'importing' ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                </div>
                <span className="text-sm font-medium text-ink">
                  {importState === 'idle' ? 'Import solves' : importState === 'preview' ? 'Preview import' : importState === 'importing' ? 'Importing...' : importState === 'done' ? 'Import complete' : 'Import failed'}
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
                  {/* Drop zone */}
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
                        Drop your file here or click to browse
                      </p>
                      <p className="mt-1 text-[0.65rem] text-ink-3">
                        csTimer CSV, CubeForge CSV/JSON, Twisty Timer, or any CSV
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
                      <strong>csTimer format:</strong> <code className="text-[0.58rem] bg-ink/5 px-1 rounded">&quot;333&quot;;&quot;Normal&quot;;&quot;12217&quot;;&quot;1620000000&quot;;&quot;R U R'&quot;;&quot;0&quot;;&quot;&quot;</code>
                      <br />
                      <strong>CSV format:</strong> <code className="text-[0.58rem] bg-ink/5 px-1 rounded">No.,Time,Penalty,Scramble,Date,Method,Note</code>
                      <br />
                      Times should be in milliseconds (csTimer) or seconds (generic CSV).
                    </div>
                  </div>
                </div>
              )}

              {importState === 'preview' && importPreview && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3">
                    <Check className="size-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[0.72rem] font-medium text-emerald-500">
                        Detected: {importPreview.format === 'cstimer' ? 'csTimer' : importPreview.format === 'cubeforge-csv' ? 'CubeForge CSV' : importPreview.format === 'cubeforge-json' ? 'CubeForge JSON' : 'Generic CSV'}
                      </p>
                      <p className="text-[0.62rem] text-ink-3 mt-0.5">
                        {importPreview.rowCount} solve{importPreview.rowCount !== 1 ? 's' : ''} found{importPreview.errorCount > 0 ? ` · ${importPreview.errorCount} error${importPreview.errorCount !== 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Preview table */}
                  {importPreview.samples.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-line">
                      <table className="w-full text-left text-[0.65rem]">
                        <thead>
                          <tr className="border-b border-line bg-surface-2">
                            {importPreview.headers.slice(0, 5).map((h, i) => (
                              <th key={i} className="px-3 py-2 font-medium text-ink-2 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.samples.map((s, i) => (
                            <tr key={i} className="border-b border-line/50 last:border-0">
                              <td className="px-3 py-2 text-ink font-mono">
                                {s.penalty === 'DNF' ? 'DNF' : `${(s.time / 1000).toFixed(2)}s`}
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
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleConfirmImport()}
                      className="rounded-md bg-ink px-4 py-1.5 text-[0.68rem] font-medium text-surface hover:bg-ink/90 transition-colors cursor-pointer"
                    >
                      Import {importPreview.rowCount} solves
                    </button>
                  </div>
                </div>
              )}

              {importState === 'importing' && (
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <Loader2 className="size-6 text-ink-2 animate-spin" />
                  <p className="text-[0.72rem] text-ink-2">Importing solves...</p>
                </div>
              )}

              {importState === 'done' && importResult && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="grid size-14 place-items-center rounded-full bg-emerald-400/10">
                    <Check className="size-6 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-[0.85rem] font-semibold text-ink">
                      {importResult.imported} solve{importResult.imported !== 1 ? 's' : ''} imported
                    </p>
                    {importResult.errors > 0 && (
                      <p className="text-[0.65rem] text-ink-3 mt-1">
                        {importResult.errors} line{importResult.errors !== 1 ? 's' : ''} skipped due to errors
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setImportOpen(false)}
                    className="rounded-lg border border-line px-4 py-2 text-[0.72rem] font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}

              {importState === 'error' && importError && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="grid size-14 place-items-center rounded-full bg-red-400/10">
                    <AlertTriangle className="size-6 text-red-400" />
                  </div>
                  <div className="text-center max-w-xs">
                    <p className="text-[0.82rem] font-semibold text-ink">Import failed</p>
                    <p className="text-[0.65rem] text-ink-3 mt-1">{importError}</p>
                  </div>
                  <button
                    onClick={() => { setImportState('idle'); setImportError(null); }}
                    className="rounded-lg border border-line px-4 py-2 text-[0.72rem] font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
