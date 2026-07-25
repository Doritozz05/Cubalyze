'use client';

import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportSolvesToCSV, exportSolvesToJSON, downloadFile } from '@/utils/exportSolves';
import type { Solve } from '@/types';

export interface DataSectionProps {
  solves: Solve[];
  sessionName?: string;
}

/**
 * Data management settings section.
 *
 * Provides CSV and JSON export buttons for solve data.
 */
export function DataSection({ solves, sessionName }: DataSectionProps) {
  const handleExportCSV = () => {
    if (solves.length === 0) return;
    const csv = exportSolvesToCSV(solves, sessionName);
    const name = (sessionName ?? 'session').replace(/[^a-z0-9_-]/gi, '_');
    downloadFile(csv, `cubeforge-${name}.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportJSON = () => {
    if (solves.length === 0) return;
    const json = exportSolvesToJSON(solves, sessionName);
    const name = (sessionName ?? 'session').replace(/[^a-z0-9_-]/gi, '_');
    downloadFile(json, `cubeforge-${name}.json`, 'application/json');
  };

  const isEmpty = solves.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Download className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">
          Export your solve data to standard formats. Compatible with csTimer and other cubing apps.
        </p>
      </div>

      {/* CSV Export */}
      <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-ink-2" />
            <h4 className="text-[0.85rem] font-medium text-ink">CSV Export</h4>
          </div>
          <p className="mt-1.5 text-[0.72rem] text-ink-3">
            Spreadsheet format compatible with csTimer, Google Sheets, and Excel.
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

      {/* JSON Export */}
      <div className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileJson className="size-4 text-ink-2" />
            <h4 className="text-[0.85rem] font-medium text-ink">JSON Export</h4>
          </div>
          <p className="mt-1.5 text-[0.72rem] text-ink-3">
            Full machine-readable export with all solve metadata.
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
          Exports include time, penalty, scramble, method, date, and notes. Compatible with most cubing timers.
        </span>
      </div>
    </div>
  );
}
