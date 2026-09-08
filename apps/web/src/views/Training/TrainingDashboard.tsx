"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { motion } from "framer-motion";
import { format, addDays, isToday } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { Target, CalendarDays, RotateCcw, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS } from "@cubeforge/algorithm-db";
import { AlgorithmDrillView } from "./AlgorithmDrillView";
import { AlgorithmRecognizeView } from "./AlgorithmRecognizeView";
import { PhaseStatsView } from "./PhaseStatsView";
import { FullSolveView } from "./FullSolveView";
import { SRSReviewView } from "./SRSReviewView";
import { SRSInsightsView } from "./SRSInsightsView";
import { PlainPracticeView } from "./PlainPracticeView";
import { BlindPracticeView } from "./BlindPracticeView";
import { CrossTrainerView } from "./CrossTrainerView";
import { LSESubPhaseView } from "./LSESubPhaseView";
import { EODetectView } from "./EODetectView";
import { EOEfficiencyView } from "./EOEfficiencyView";
import { InfiniteF2LView } from "./infinite-f2l/InfiniteF2LView";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { useSRSQueue } from "@/hooks/useSRSQueue";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import type { PuzzleCategory } from "@/types";
import type { PhaseStatsRecord, PhasePracticeType } from "@cubeforge/training";
import type { TrainingTask, TaskRepeat, TaskColor } from "@cubeforge/database";
import { EXERCISE_IDS } from "@cubeforge/training";
import { puzzleCategoryToType, SELECTABLE_PUZZLE_CATEGORIES } from "@/utils/puzzleUtils";
import {
  TrainingPractice,
  MethodRailItem,
  getPhasesForMethod,
} from "./components/DashboardSections";
import { TrainingCalendar, getTasksForDate, COLOR_HEX } from "./TrainingCalendar";
import { ReviewQueueSection } from "./components";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ──────────────────────────────────────────────────────────────────────────
   Training shell.
   No page header: the app's global header owns title + puzzle context.
   Touch keeps a slim tab bar (Practice / Calendar / Review) with an animated
   underline. Desktop is a single-page dashboard — no tabs: a methods rail on
   the left and one scrolling content panel that shows the practice workspace,
   today's review queue and the planning calendar on a single screen.
   Sub-views take over the stage full-screen with back navigation.
   ─────────────────────────────────────────────────────────────────────── */

type TrainingSection = "practice" | "calendar" | "review";

const TRAINING_SECTIONS: { id: TrainingSection; labelKey: ParseKeys<"training">; icon: React.ElementType }[] = [
  { id: "practice", labelKey: "tabs.practice", icon: Target },
  { id: "calendar", labelKey: "tabs.calendar", icon: CalendarDays },
  { id: "review", labelKey: "tabs.review", icon: RotateCcw },
];

interface DrillViewState {
  methodId: string;
  phaseId: string;
  subsetId: string;
}

interface PracticeViewState {
  methodId: string;
  phaseId: string;
  phaseName: string;
  phaseType: PhasePracticeType;
  modeId: string;
}

interface RecognizeViewState {
  methodId: string;
  phaseId: string;
  subsetId: string;
}

interface StatsViewState {
  methodId: string;
  phaseId: string;
  phaseName: string;
}

interface FullSolveViewState {
  methodId: string;
}

interface InfiniteF2LViewState {
  methodId: string;
  phaseId: string;
  phaseName: string;
}

export interface TrainingDashboardProps {
  preset?: { subsetId: string; caseId: string } | null;
  onPresetConsumed?: () => void;
  puzzle?: PuzzleCategory;
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
}

export function TrainingDashboard({
  preset,
  onPresetConsumed,
  puzzle: puzzleProp = "3x3",
  onPuzzleChange,
}: TrainingDashboardProps = {}) {
  const { t } = useTranslation("training");
  const [activeSection, setActiveSection] = useState<TrainingSection>("practice");
  const [selectedPuzzle, setSelectedPuzzle] = useState<PuzzleCategory>(puzzleProp);

  // Synchronize internal puzzle selection with the app-wide puzzle context.
  useEffect(() => {
    if (puzzleProp) {
      setSelectedPuzzle(puzzleProp);
    }
  }, [puzzleProp]);

  const targetPuzzleType = puzzleCategoryToType(selectedPuzzle);

  const puzzleMethods = useMemo(() => {
    return METHODS.filter((m) => (m.puzzleType ?? "333") === targetPuzzleType);
  }, [targetPuzzleType]);

  const [activeMethodId, setActiveMethodId] = useState<string>(() => puzzleMethods[0]?.id ?? METHODS[0]?.id ?? "");

  // Auto-switch activeMethodId when puzzle changes if current method is not compatible
  useEffect(() => {
    if (puzzleMethods.length > 0 && !puzzleMethods.some((m) => m.id === activeMethodId)) {
      setActiveMethodId(puzzleMethods[0].id);
    }
  }, [puzzleMethods, activeMethodId]);

  const handleSelectPuzzle = (p: PuzzleCategory) => {
    setSelectedPuzzle(p);
    onPuzzleChange?.(p);
    const newTargetType = puzzleCategoryToType(p);
    const newMethods = METHODS.filter((m) => (m.puzzleType ?? "333") === newTargetType);
    if (newMethods.length > 0) {
      setActiveMethodId(newMethods[0].id);
    }
  };

  // Live due-review count: the toolbar badge, the today strip and the view
  // states always match the queue, even while the queue preview is unmounted.
  const { queue: dueQueue, refresh: refreshQueue } = useSRSQueue();
  const dueCount = dueQueue.length;

  // Sub-view routing (direct from exercise rows, no L2)
  const [drillView, setDrillView] = useState<DrillViewState | null>(null);
  const [practiceView, setPracticeView] = useState<PracticeViewState | null>(null);
  const [infiniteF2LView, setInfiniteF2LView] = useState<InfiniteF2LViewState | null>(null);
  const [recognizeView, setRecognizeView] = useState<RecognizeViewState | null>(null);
  const [statsView, setStatsView] = useState<StatsViewState | null>(null);
  const [fullSolveView, setFullSolveView] = useState<FullSolveViewState | null>(null);
  const [reviewView, setReviewView] = useState<{ methodId?: string } | null>(null);
  const [insightsView, setInsightsView] = useState<{ methodId?: string } | null>(null);

  // Progress tracking
  const { ready: dbReady, getMethodMastery, getPhaseStats } = useTrainingProgress();
  const [methodMasteries, setMethodMasteries] = useState<Record<string, number>>({});
  const [phaseStatsMap, setPhaseStatsMap] = useState<Record<string, PhaseStatsRecord | null>>({});
  const [masteriesKey, setMasteriesKey] = useState(0);

  // Load method masteries. Re-runs on `masteriesKey` bump so the rail
  // percentages reflect drills/recognize/review sessions the moment the
  // user returns.
  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;
    async function load() {
      const masteries: Record<string, number> = {};
      for (const method of METHODS) {
        try {
          const m = await getMethodMastery(method.id);
          masteries[method.name] = m;
        } catch {
          masteries[method.name] = 0;
        }
      }
      if (!cancelled) setMethodMasteries(masteries);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [dbReady, getMethodMastery, masteriesKey]);

  // Load real per-phase accuracy for the active method's practice rows —
  // replaces the old fabricated formula (mastery * 0.8 + sortOrder * 3).
  useEffect(() => {
    if (!dbReady || !activeMethodId) return;
    let cancelled = false;
    const method = METHODS.find((m) => m.id === activeMethodId);
    const phases = method ? getPhasesForMethod(method.name) : [];
    void Promise.all(
      phases.map((phase) => getPhaseStats(activeMethodId, phase.id).catch(() => null)),
    ).then((stats) => {
      if (cancelled) return;
      const map: Record<string, PhaseStatsRecord | null> = {};
      phases.forEach((phase, i) => { map[phase.id] = stats[i]; });
      setPhaseStatsMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [dbReady, activeMethodId, getPhaseStats, masteriesKey]);

  // ── Algorithms → Training bridge ─────────────────────────────────────
  const [drillPresetCaseId, setDrillPresetCaseId] = useState<string | null>(
    () => preset?.caseId ?? null,
  );
  if (preset?.caseId && preset.caseId !== drillPresetCaseId) {
    setDrillPresetCaseId(preset.caseId);
  }

  const initialDrillView = useMemo(() => {
    if (!preset?.subsetId) return null;
    const subset = SUBSETS.find((s) => s.id === preset.subsetId);
    if (!subset) return null;
    return { methodId: subset.methodId, phaseId: "", subsetId: preset.subsetId };
  }, [preset?.subsetId]);

  useEffect(() => {
    if (preset?.subsetId) {
      const subset = SUBSETS.find((s) => s.id === preset.subsetId);
      if (subset) {
        setActiveMethodId(subset.methodId);
        const method = METHODS.find((m) => m.id === subset.methodId);
        if (method?.puzzleType === "222") {
          setSelectedPuzzle("2x2");
        } else if (method?.puzzleType === "333") {
          setSelectedPuzzle("3x3");
        }
      }
      onPresetConsumed?.();
    }
  }, [preset?.subsetId, onPresetConsumed]);

  useEffect(() => {
    if (initialDrillView && !drillView) {
      setDrillView(initialDrillView);
    }
  }, [initialDrillView, drillView]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleDrill = (methodId: string, phaseId: string, subsetId: string) => {
    setDrillView({ methodId, phaseId, subsetId });
  };

  const handleRecognize = (methodId: string, phaseId: string, subsetId: string) => {
    setRecognizeView({ methodId, phaseId, subsetId });
  };

  const handlePracticeMode = (methodId: string, phaseId: string, phaseName: string, phaseType: PhasePracticeType, mode: string) => {
    setPracticeView({ methodId, phaseId, phaseName, phaseType, modeId: mode });
  };

  const handleInfiniteF2L = (methodId: string, phaseId: string, phaseName: string) => {
    setInfiniteF2LView({ methodId, phaseId, phaseName });
  };

  const handleStats = (methodId: string, phaseId: string, phaseName: string) => {
    setStatsView({ methodId, phaseId, phaseName });
  };

  const handleFullSolve = (methodId: string) => {
    setFullSolveView({ methodId });
  };

  const handleStartReview = (methodId?: string) => {
    setReviewView({ methodId });
  };

  const handleOpenInsights = (methodId?: string) => {
    setInsightsView(methodId ? { methodId } : {});
  };

  const handleBackFromSubView = () => {
    setDrillView(null);
    setPracticeView(null);
    setInfiniteF2LView(null);
    setRecognizeView(null);
    setStatsView(null);
    setFullSolveView(null);
    setReviewView(null);
    setInsightsView(null);
    // Refresh the method mastery tabs AND the due-review count after any
    // drill/recognize/review session.
    setMasteriesKey((k) => k + 1);
    void refreshQueue();
  };

  // ── L3 Sub-views ────────────────────────────────────────────────────

  if (drillView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <AlgorithmDrillView
            methodId={drillView.methodId}
            phaseId={drillView.phaseId}
            subsetId={drillView.subsetId}
            onBack={handleBackFromSubView}
            preselectedCaseId={drillPresetCaseId}
          />
        </div>
      </div>
    );
  }

  if (recognizeView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <AlgorithmRecognizeView
            methodId={recognizeView.methodId}
            phaseId={recognizeView.phaseId}
            subsetId={recognizeView.subsetId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (statsView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <PhaseStatsView
            methodId={statsView.methodId}
            phaseId={statsView.phaseId}
            phaseName={statsView.phaseName}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (fullSolveView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <FullSolveView
            methodId={fullSolveView.methodId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (reviewView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <SRSReviewView
            methodId={reviewView.methodId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (insightsView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <SRSInsightsView
            methodId={insightsView.methodId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (infiniteF2LView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <InfiniteF2LView
            methodId={infiniteF2LView.methodId}
            phaseId={infiniteF2LView.phaseId}
            phaseName={infiniteF2LView.phaseName}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (practiceView) {
    const { methodId, phaseId, phaseName, phaseType, modeId } = practiceView;
    const props = { methodId, phaseId, phaseName, onBack: handleBackFromSubView };

    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          {/* Generic: plain + speed-vs-eff (S/E persists its own exercise id) */}
          {modeId === "plain" && <PlainPracticeView {...props} />}
          {modeId === "speed-vs-eff" && (
            <PlainPracticeView
              {...props}
              exerciseLabel={t("speedVsEfficiency")}
              exerciseId={EXERCISE_IDS.speedEfficiency(methodId, phaseId)}
            />
          )}
          {/* Generic: blind */}
          {modeId === "blind" && <BlindPracticeView {...props} />}

          {/* Cross-specific */}
          {phaseType === "cross" && (modeId === "optimal" || modeId === "cn") && (
            <CrossTrainerView {...props} />
          )}

          {/* LSE-specific */}
          {phaseType === "lse" && (modeId === "eo" || modeId === "ulur" || modeId === "mslice") && (
            <LSESubPhaseView {...props} subPhase={modeId} />
          )}

          {/* EO-specific */}
          {phaseType === "eo" && modeId === "detect" && <EODetectView {...props} />}
          {phaseType === "eo" && modeId === "efficiency" && <EOEfficiencyView {...props} />}
        </div>
      </div>
    );
  }

  // ── Training shell ──────────────────────────────────────────────────

  return (
    <div className="relative flex w-full min-h-0 flex-1 flex-col max-lg:px-3 max-lg:pt-2 lg:px-6 lg:pt-3">
      {/* Header row: puzzle selector + due badge. Section tabs stay inline
          on touch; on desktop they live in the left nav panel below. */}
      <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2.5 pb-3 pt-2 lg:hidden">
        <div className="flex flex-wrap items-center gap-5 sm:gap-6">
          {/* Section nav tabs — touch only (desktop: left panel) */}
          <div className="flex items-center gap-5 lg:hidden">
            {TRAINING_SECTIONS.map((s) => {
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative cursor-pointer pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] transition-colors",
                    isActive ? "text-ink" : "text-ink-3 hover:text-ink",
                  )}
                >
                  {t(s.labelKey)}
                  {s.id === "review" && dueCount > 0 && (
                    <span className="nums ml-1.5 inline-grid min-w-4 place-items-center rounded-full bg-caution px-1 py-px align-middle text-[0.55rem] font-bold leading-none text-surface">
                      {dueCount}
                    </span>
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="training-view-underline"
                      className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="h-3.5 w-px bg-line/60 hidden sm:block lg:hidden" />

          {/* Puzzle selector — touch only (desktop: left panel header) */}
          <PuzzleSelector value={selectedPuzzle} onChange={handleSelectPuzzle} />
        </div>

        {/* Due count badge on the far right (only in review section) */}
        {activeSection === "review" && dueCount > 0 && (
          <span className="nums inline-flex shrink-0 items-center gap-1.5 rounded-full bg-caution px-2.5 py-0.5 text-[0.6rem] font-semibold text-surface">
            <span className="size-1.5 shrink-0 rounded-full bg-surface" />
            {t("dueForReview", { count: dueCount })}
          </span>
        )}
      </div>

      {/* Mobile section content — tabbed, unchanged (desktop: dashboard) */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        {activeSection === "practice" && (
          <TrainingPractice
            puzzleMethods={puzzleMethods}
            activeMethodId={activeMethodId}
            onSelectMethod={setActiveMethodId}
            methodMasteries={methodMasteries}
            phaseStatsMap={phaseStatsMap}
            onDrill={handleDrill}
            onRecognize={handleRecognize}
            onPracticeMode={handlePracticeMode}
            onInfiniteF2L={handleInfiniteF2L}
            onStats={handleStats}
            onFullSolve={handleFullSolve}
          />
        )}

        {activeSection === "calendar" && (
          <CalendarView dueCount={dueCount} onStartReview={handleStartReview} />
        )}

        {activeSection === "review" && (
          <ReviewView
            dbReady={dbReady}
            dueCount={dueCount}
            onStartReview={handleStartReview}
            onOpenInsights={handleOpenInsights}
            onGoPractice={() => setActiveSection("practice")}
          />
        )}
      </div>

      {/* Desktop: single-page dashboard — methods rail on the left, and the
          content panel scrolls practice + today's review + the planning
          calendar as one page. No tabs: everything on one screen. */}
      <div className="hidden min-h-0 flex-1 gap-5 lg:flex">
        {/* Methods rail */}
        <aside
          className="flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-surface"
          data-context-zone="training-methods"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <PuzzleSelector value={selectedPuzzle} onChange={handleSelectPuzzle} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <p className="px-2 pb-1.5 pt-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {t("method")}
            </p>
            {puzzleMethods.map((m) => (
              <MethodRailItem
                key={m.id}
                method={m}
                mastery={methodMasteries[m.name] ?? 0}
                active={m.id === activeMethodId}
                onClick={() => setActiveMethodId(m.id)}
              />
            ))}
          </div>
        </aside>

        {/* Content panel — one scrollable page */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg">
          {/* Practice workspace — embedded so the panel owns the scroll */}
          <TrainingPractice
            embedded
            puzzleMethods={puzzleMethods}
            activeMethodId={activeMethodId}
            onSelectMethod={setActiveMethodId}
            methodMasteries={methodMasteries}
            phaseStatsMap={phaseStatsMap}
            onDrill={handleDrill}
            onRecognize={handleRecognize}
            onPracticeMode={handlePracticeMode}
            onInfiniteF2L={handleInfiniteF2L}
            onStats={handleStats}
            onFullSolve={handleFullSolve}
          />

          {/* Today's review queue + planning calendar */}
          <div className="grid items-start gap-5 px-6 pb-6 xl:grid-cols-2">
            <ReviewQueueSection
              onStartReview={handleStartReview}
              onOpenInsights={handleOpenInsights}
            />
            <TrainingCalendar />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Puzzle selector (shared by the touch header and the desktop panel) ── */

function PuzzleSelector({
  value,
  onChange,
}: {
  value: PuzzleCategory;
  onChange: (p: PuzzleCategory) => void;
}) {
  const { t } = useTranslation("training");
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
        {t("puzzle")}
      </span>
      <Select value={value} onValueChange={(val) => onChange(val as PuzzleCategory)}>
        {/* Same trigger treatment as the Insights filters — identical
            compact look: no fixed width, no item icons, and the shared
            Select's 44px touch min-height pinned back. */}
        <SelectTrigger
          size="sm"
          className="h-7 w-auto gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-ink-2 max-lg:min-h-7! max-lg:py-1"
        >
          <SelectValue placeholder={t("selectPuzzle")} />
        </SelectTrigger>
        <SelectContent>
          {SELECTABLE_PUZZLE_CATEGORIES.map((p) => (
            <SelectItem key={p} value={p} className="text-xs">
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ── Calendar screen — planning + today's reviews ─────────────────────── */

interface PlanTemplate {
  id: string;
  titleKey: ParseKeys<"training">;
  repeat: TaskRepeat;
  daysOfWeek: number[];
  color: TaskColor;
}

/** One-click routines that seed an empty plan — the calendar's quick start. */
const PLAN_TEMPLATES: PlanTemplate[] = [
  { id: "f2l-drill", titleKey: "calendar.template.f2lDrill", repeat: "daily", daysOfWeek: [], color: "emerald" },
  { id: "pll-recognition", titleKey: "calendar.template.pllRecognition", repeat: "weekdays", daysOfWeek: [], color: "violet" },
  { id: "cross-blind", titleKey: "calendar.template.crossBlind", repeat: "weekdays", daysOfWeek: [], color: "cyan" },
  { id: "full-solve", titleKey: "calendar.template.fullSolve", repeat: "weekly", daysOfWeek: [], color: "amber" },
];

/** Reuses the calendar's repeat vocabulary so labels stay consistent. */
const TEMPLATE_REPEAT_KEY: Record<TaskRepeat, ParseKeys<"training">> = {
  none: "calendar.repeat.none",
  daily: "calendar.repeat.daily",
  weekdays: "calendar.repeat.weekdays",
  weekly: "calendar.repeat.weekly",
  monthly: "calendar.repeat.monthly",
  custom: "calendar.repeat.custom",
};

function CalendarView({
  dueCount,
  onStartReview,
}: {
  dueCount: number;
  onStartReview: (methodId?: string) => void;
}) {
  const { t, i18n } = useTranslation("training");
  const dfLocale = i18n.language === "es" ? es : enUS;
  const { tasks, setTasks } = useCalendarTasks();

  // The next 7 days that actually have something planned.
  const upcomingDays = useMemo(() => {
    const days: { date: Date; tasks: TrainingTask[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(new Date(), i);
      const dayTasks = getTasksForDate(tasks, day);
      if (dayTasks.length > 0) days.push({ date: day, tasks: dayTasks });
    }
    return days;
  }, [tasks]);

  const addTemplate = useCallback(
    (tmpl: PlanTemplate) => {
      const task: TrainingTask = {
        id: crypto.randomUUID(),
        title: t(tmpl.titleKey),
        description: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
        repeat: tmpl.repeat,
        daysOfWeek: tmpl.daysOfWeek,
        color: tmpl.color,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, task]);
      toast(t("calendar.added"), { description: t(tmpl.titleKey) });
    },
    [setTasks, t],
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-safe">
      {/* p-1 on touch offsets the shell's px-3 gutter (same phone margin
          as before the panel wrap); sm:p-6 keeps desktop spacing. */}
      <div className="mx-auto max-w-5xl p-1 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {t("tabs.calendar")}
          </p>
          {dueCount > 0 && (
            <button
              onClick={() => onStartReview()}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-caution/30 bg-caution/10 px-3 text-[0.62rem] font-medium text-caution transition-colors hover:bg-caution/15"
            >
              <RotateCcw className="size-3" />
              {t("todayDue", { count: dueCount })}
            </button>
          )}
        </div>

        {/* items-start: each column keeps its natural height — a long side
            panel must never stretch the calendar into empty space */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
          {/* Calendar grid — lifted state so the side panel stays in sync */}
          <TrainingCalendar tasks={tasks} setTasks={setTasks} />

          {/* Side panel: this week + one-click plan templates */}
          <div className="flex min-w-0 flex-col gap-4">
            <section className="rounded-xl border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
                <CalendarDays className="size-3.5 text-ink-2" />
                <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink">
                  {t("calendar.upcoming")}
                </h3>
              </div>
              <div className="p-3.5">
                {upcomingDays.length === 0 ? (
                  <p className="py-3 text-center text-[0.62rem] leading-relaxed text-ink-3/70">
                    {t("calendar.weekEmpty")}
                  </p>
                ) : (
                  <ul className="max-h-80 space-y-3 overflow-y-auto overscroll-contain pr-1 lg:max-h-105">
                    {upcomingDays.map(({ date, tasks: dayTasks }) => (
                      <li key={format(date, "yyyy-MM-dd")}>
                        <p className="mb-1 text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
                          {isToday(date) ? t("calendar.today") : format(date, "EEE, MMM d", { locale: dfLocale })}
                        </p>
                        <ul className="space-y-1">
                          {dayTasks.map((task) => (
                            <li key={task.id} className="flex items-center gap-2 text-[0.62rem]">
                              <span
                                className="size-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: COLOR_HEX[task.color] }}
                              />
                              <span className="min-w-0 flex-1 truncate font-medium text-ink">{task.title}</span>
                              {task.repeat !== "none" && (
                                <RotateCcw className="size-2.5 shrink-0 text-ink-3/50" />
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
                <Sparkles className="size-3.5 text-ink-2" />
                <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink">
                  {t("calendar.suggestions")}
                </h3>
              </div>
              <div className="p-3.5">
                <p className="mb-3 text-[0.6rem] leading-relaxed text-ink-3/70">
                  {t("calendar.suggestionsHint")}
                </p>
                <ul className="space-y-1.5">
                  {PLAN_TEMPLATES.map((tmpl) => (
                    <li key={tmpl.id}>
                      <button
                        onClick={() => addTemplate(tmpl)}
                        className="group flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-line bg-surface-2/50 px-2.5 py-2 text-left transition-colors hover:border-ink/20 hover:bg-surface-2"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: COLOR_HEX[tmpl.color] }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.65rem] font-medium text-ink">
                            {t(tmpl.titleKey)}
                          </span>
                          <span className="block text-[0.56rem] text-ink-3">
                            {t(TEMPLATE_REPEAT_KEY[tmpl.repeat])}
                          </span>
                        </span>
                        <Plus className="size-3 shrink-0 text-ink-3 transition-colors group-hover:text-ink" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Review screen — the SRS queue, or a guided empty state ───────────── */

function ReviewView({
  dbReady,
  dueCount,
  onStartReview,
  onOpenInsights,
  onGoPractice,
}: {
  dbReady: boolean;
  dueCount: number;
  onStartReview: (methodId?: string) => void;
  onOpenInsights: (methodId?: string) => void;
  onGoPractice: () => void;
}) {
  const { t } = useTranslation("training");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-safe">
      {/* p-1 on touch offsets the shell's px-3 gutter (same phone margin
          as before the panel wrap); sm:p-6 keeps desktop spacing. */}
      <div className="mx-auto max-w-3xl p-1 sm:p-6">
        {!dbReady ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="sm" />
          </div>
        ) : dueCount > 0 ? (
          <ReviewQueueSection onStartReview={onStartReview} onOpenInsights={onOpenInsights} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-surface-2">
              <RotateCcw className="size-5 text-ink-3" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{t("review.emptyTitle")}</p>
              <p className="mx-auto mt-1 max-w-xs text-[0.7rem] leading-relaxed text-ink-3">
                {t("review.emptyBody")}
              </p>
            </div>
            <button
              onClick={onGoPractice}
              className="mt-1 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-ink px-3.5 text-[0.68rem] font-semibold text-surface transition-colors hover:bg-ink/90"
            >
              <Target className="size-3.5" />
              {t("goPractice")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
