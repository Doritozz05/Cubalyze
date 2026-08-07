"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Video,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Eye,
  Trophy,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReplaySection } from "@/components/Insights/ReplaySection";
import { AlgorithmNotation, SectionHeader } from "@/components/Insights/atoms";
import {
  fetchReconRecord,
  reconToSolve,
  type ReconFullRecord,
  type ReconPhase,
} from "./reconData";
import { OurDetectionPanel } from "./OurDetectionPanel";
import { formatDisplayDate } from "./ReconstructionsView";

// ─── Phase type / color helpers ─────────────────────────────────────────────

type PhaseKind = "cross" | "f2l" | "oll" | "pll" | "other";

function phaseKind(label: string): PhaseKind {
  const l = label.toLowerCase();
  if (/cross/i.test(l)) return "cross";
  if (/oll/i.test(l) && !/f2l|pair/i.test(l)) return "oll";
  if (/pll/i.test(l)) return "pll";
  if (/f2l|pair/i.test(l)) return "f2l";
  return "other";
}

const KIND_DOT: Record<PhaseKind, string> = {
  cross: "bg-phase-blue-500",
  f2l: "bg-phase-emerald",
  oll: "bg-phase-amber",
  pll: "bg-phase-violet",
  other: "bg-line-2",
};


export function getMethodBadgeClass(method: string): string {
  const m = (method || "").toUpperCase();
  if (m.includes("CFOP") || m.includes("CROSS") || m.includes("F2L")) {
    return "border-phase-blue/40 bg-phase-blue/10 text-phase-blue";
  }
  if (m.includes("ROUX") || m.includes("PLL")) {
    return "border-phase-violet/40 bg-phase-violet/10 text-phase-violet";
  }
  if (m.includes("EG") || m.includes("CLL") || m.includes("ORTEGA") || m.includes("PBL")) {
    return "border-phase-emerald/40 bg-phase-emerald/10 text-phase-emerald";
  }
  if (m.includes("ZB") || m.includes("YAU") || m.includes("HOYA") || m.includes("L4E") || m.includes("L2L")) {
    return "border-phase-amber/40 bg-phase-amber/10 text-phase-amber";
  }
  return "border-line bg-surface-2 text-ink-3";
}

// ─── Stat chip ──────────────────────────────────────────────────────────────

function StatChip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-line/70 bg-surface px-2.5 py-1.5">
      <span className="text-[0.56rem] font-semibold uppercase tracking-wider text-ink-3">
        {label}
      </span>
      <span className={cn("nums text-[0.8rem] font-semibold tabular-nums", accent ?? "text-ink")}>
        {value}
      </span>
    </div>
  );
}

// ─── Phase row ──────────────────────────────────────────────────────────────

function PhaseRow({ phase, last }: { phase: ReconPhase; last: boolean }) {
  const kind = phaseKind(phase.label);
  const recog = phase.recog;
  const hasCase = !!recog?.caseNumber;
  const caseText = recog?.caseNumber ?? null;

  return (
    <div
      className={cn(
        "grid grid-cols-[0.75rem_7.5rem_6.5rem_1fr_2.75rem] items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-2",
        !last && "border-b border-line/60",
      )}
    >
      <span className={cn("size-1.5 rounded-full", KIND_DOT[kind])} />

      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[0.74rem] font-medium text-ink">{phase.label}</span>
      </span>

      <span className="min-w-0">
        {hasCase ? (
          <span className="flex items-center gap-1.5">
            <span className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.64rem] font-semibold text-ink">
              {caseText}
            </span>
            {recog!.slot && (
              <span className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[0.56rem] font-medium text-ink-2">
                {recog!.slot}
              </span>
            )}
            {recog!.verified ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldCheck className="size-3 shrink-0 text-ready" />
                </TooltipTrigger>
                <TooltipContent side="top">Case matched from the cube state</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldAlert className="size-3 shrink-0 text-caution" />
                </TooltipTrigger>
                <TooltipContent side="top">Recognized but not fully verified</TooltipContent>
              </Tooltip>
            )}
          </span>
        ) : recog ? (
          <span className="text-[0.64rem] text-ink-3">—</span>
        ) : (
          <span className="text-[0.64rem] text-ink-3/50">·</span>
        )}
      </span>

      <span className="min-w-0">
        {phase.moves ? (
          <AlgorithmNotation notation={phase.moves} size="sm" />
        ) : (
          <span className="text-xs text-ink-3">—</span>
        )}
      </span>

      <span className="nums text-right text-xs text-ink-2">{phase.moveCount}</span>
    </div>
  );
}

// ─── View ───────────────────────────────────────────────────────────────────

export function ReconstructionDetailView({
  recordKey,
  onBack,
}: {
  recordKey: string;
  onBack: () => void;
}) {
  const [record, setRecord] = useState<ReconFullRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setError(null);
    fetchReconRecord(recordKey)
      .then((r) => {
        if (!cancelled) setRecord(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load reconstruction");
      });
    return () => {
      cancelled = true;
    };
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
        <p className="text-sm text-dnf">{error}</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" /> Back
        </Button>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex h-full flex-col gap-3 px-6 py-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const stm = record.stm;
  const tps = record.tps;
  const recog = record.recognition;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Scrollable content ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 py-4">
          {/* Back */}
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-1 text-xs font-medium text-ink-3 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> Reconstructions
          </button>

          {/* ── Header ── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  {record.solver}
                </h2>
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider",
                    getMethodBadgeClass(record.method),
                  )}
                >
                  {record.method}
                </span>
                <span className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[0.6rem] font-medium text-ink-3">
                  {record.source}
                </span>
                {record.stats.recordAverage && (
                  <span className="rounded bg-caution/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-caution border border-caution/30">
                    {record.stats.recordAverage}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                <span className="flex items-center gap-1">
                  <Trophy className="size-3" /> {record.competition || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" /> {formatDisplayDate(record.date, record.competition, record.url)}
                </span>
                <span className="nums flex items-center gap-1">
                  <span className="text-ink-2">#{record.id}</span>
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="nums text-4xl font-bold tabular-nums leading-none text-ink">
                {record.time > 0 ? formatTime(record.time * 1000) : "—"}
              </div>
              <div className="mt-1 flex items-center justify-end gap-2">
                {record.url && (
                  <a
                    href={record.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-ink-3 transition-colors hover:text-ink"
                  >
                    <ExternalLink className="size-3" /> Source
                  </a>
                )}
                {record.stats.videoUrl && (
                  <a
                    href={record.stats.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-ink-3 transition-colors hover:text-ink"
                  >
                    <Video className="size-3" /> Video
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Scramble */}
          {record.scramble && (
            <div className="mt-3 rounded-md border border-line bg-surface px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.58rem] font-semibold uppercase tracking-wider text-ink-3">
                  Scramble
                </span>
                <span className="text-[0.58rem] text-ink-3">{stm ?? "—"} STM</span>
              </div>
              <p className="font-mono text-[0.72rem] leading-relaxed text-ink-2">
                {record.scramble}
              </p>
            </div>
          )}

          {/* ── Stat chips ── */}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <StatChip label="STM" value={stm != null ? String(stm) : "—"} />
            <StatChip label="TPS" value={tps != null ? tps.toFixed(2) : "—"} />
            <StatChip
              label="Cross STM"
              value={record.stats.crossStm != null ? String(record.stats.crossStm) : "—"}
            />
            <StatChip label="F2L" value={record.stats.f2l != null ? String(record.stats.f2l) : "—"} />
            <StatChip label="LL" value={record.stats.ll != null ? String(record.stats.ll) : "—"} />
            <StatChip
              label="Rotations"
              value={String(record.rotationCount ?? 0)}
            />
          </div>

          {/* Recognition summary */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.66rem]">
            <span
              className={cn(
                "flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium",
                recog.finalSolved
                  ? "border-ready/40 bg-ready/10 text-ready"
                  : "border-caution/40 bg-caution/10 text-caution",
              )}
            >
              <ShieldCheck className="size-3" />
              {recog.finalSolved ? "Coherent solve" : "Stream inconsistent"}
            </span>
            {recog.inspection && (
              <span className="flex items-center gap-1 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-ink-2">
                <Eye className="size-3" /> inspection {recog.inspection}
              </span>
            )}
            <span
              className={cn(
                "flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium",
                recog.crossVerified
                  ? "border-ready/40 bg-ready/10 text-ready"
                  : "border-line bg-surface-2 text-ink-3",
              )}
            >
              <RotateCcw className="size-3" />
              cross {recog.crossVerified ? "verified" : "unverified"}
            </span>
          </div>

          {/* ── Replay ── */}
          {solve && (
            <div className="mt-4">
              <ReplaySection solve={solve} />
            </div>
          )}

          {/* ── Our detection (Fase 3) ── */}
          <OurDetectionPanel record={record} />

          {/* ── Phase table (Quest-style) ── */}
          {record.phases.length > 0 && (
            <div className="mt-4 rounded-lg border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                <SectionHeader title="Steps" eyebrow="phases · cases · moves" />
                <span className="nums text-xs text-ink-3">
                  {record.phases.reduce((n, p) => n + p.moveCount, 0)} moves
                </span>
              </div>

              <div className="grid grid-cols-[0.75rem_7.5rem_6.5rem_1fr_2.75rem] items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-1.5 text-[0.58rem] font-semibold uppercase tracking-wider text-ink-3">
                <span />
                <span>Phase</span>
                <span>Case</span>
                <span>Moves</span>
                <span className="text-right">#</span>
              </div>

              {record.phases.map((p, i) => (
                <PhaseRow
                  key={`${p.label}-${i}`}
                  phase={p}
                  last={i === record.phases.length - 1}
                />
              ))}
            </div>
          )}

          {/* ── Raw text ── */}
          {record.text && (
            <div className="mt-4 rounded-lg border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                <SectionHeader title="Reconstruction" eyebrow="raw solution" />
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 px-2 text-xs text-ink-3 hover:text-ink">
                  {copied ? <Check className="size-3 text-ready" /> : <Copy className="size-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="max-h-80 overflow-y-auto px-4 py-3 font-mono text-[0.72rem] leading-relaxed text-ink-2">
                {record.text}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
