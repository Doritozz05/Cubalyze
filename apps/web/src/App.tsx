import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { MainLayout } from "@/components/Layout/MainLayout";
import { LeftSidebar } from "@/components/Layout/LeftSidebar";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { SessionStats } from "@/components/Stats/SessionStats";
import { TimesList } from "@/components/Stats/TimesList";
import { StatsPanel } from "@/components/Stats/StatsPanel";
import { SolveAnalysisPanel } from "@/components/Stats/SolveAnalysisPanel";
import { Cube3DPanel } from "@/components/Cube3D/Cube3DPanel";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";
import { useShortcuts } from "@/hooks/useShortcuts";
import { usePersistentSession } from "@/hooks/usePersistentSession";
import { useSolveSession, runAnalysis } from "@/hooks/useSolveSession";
import { useOrientation } from "@/hooks/useOrientation";
import { preferencesStore } from "@cubeforge/state";
import { RandomStateGenerator, Min2PhaseSolver } from "@cubeforge/math-core";
import { ThemeProvider } from "@/components/theme-provider";
import type { Penalty, SolveMethod } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";
import "@/index.css";

export default function App() {
  const {
    session,
    sessions,
    solves,
    loading,
    addSolve,
    updateSolve,
    deleteSolve,
    clearSession,
    newSession,
    switchSession,
    renameSession,
    deleteSession,
  } = usePersistentSession();

  const methodPref = useStore(preferencesStore, (s) => s.method);

  const [scrambleIndex, setScrambleIndex] = useState(0);
  const [cube3DActive, setCube3DActive] = useState(false);
  const [cube3DReady, setCube3DReady] = useState(false);
  const [sidebarActive, setSidebarActive] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentScramble, setCurrentScramble] = useState(() =>
    RandomStateGenerator.generateScramble(new Min2PhaseSolver()),
  );

  // ── Last solve analysis (displayed in sidebar "Analysis" tab) ─────────
  const lastSolveRef = useRef<{
    solve: ReturnType<typeof usePersistentSession>['solves'][number] | null;
    analysis: SolveMetrics | null;
  }>({ solve: null, analysis: null });
  const [lastAnalysis, setLastAnalysis] = useState<SolveMetrics | null>(null);
  // Track the DB solve ID for the current solve so we can persist analysis later
  const pendingSolveIdRef = useRef<string | null>(null);
  // Selected solve for historical analysis viewing
  const [selectedSolve, setSelectedSolve] = useState<import("@/types").Solve | null>(null);

  const handleRegenerate = useCallback(() => {
    setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
    setScrambleIndex((i) => i + 1);
    toast.success("New scramble");
  }, []);

  const handleComplete = useCallback(
    (time: number, penalty: Penalty) => {
      // Capture the current scramble before it changes
      const capturedScramble = currentScramble;
      const capturedMethod = methodPref;

      addSolve({
        time,
        scramble: capturedScramble,
        penalty,
        method: capturedMethod,
      })
        .then((solveId) => {
          pendingSolveIdRef.current = solveId;
          setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
          setScrambleIndex((i) => i + 1);
        })
        .catch(() => toast.error("Couldn't save solve"));
    },
    [addSolve, currentScramble, methodPref],
  );

  // ── Centralised orchestration ───────────────────────────────────────────
  const session$ = useSolveSession(currentScramble, { onSolve: handleComplete });
  const {
    phase: timerPhase,
    time: timerTime,
    lastTime: timerLastTime,
    press: timerPress,
    release: timerRelease,
    cancel: timerCancel,
    validation,
    smartCubeConnected,
    inspection,
    scrambleVerification,
    method,
    lastSolveMoves,
    lastSolveOrientations,
    lastSolveStartState,
  } = session$;

  // ── Run analysis on solve complete ─────────────────────────────────────
  const prevLastTimeRef = useRef<number | null>(null);
  // Capture scramble & method at solve stop time to avoid stale closure race
  const scrambleAtSolveRef = useRef<string>("");
  const methodAtSolveRef = useRef<SolveMethod>("CFOP");

  useEffect(() => {
    // Capture scramble & method when solve stops (before handleComplete regenerates)
    if (timerLastTime !== null && timerLastTime !== prevLastTimeRef.current) {
      scrambleAtSolveRef.current = currentScramble;
      methodAtSolveRef.current = method;
    }

    // Detect new solve completion (lastTime changed from something to a new value)
    if (timerLastTime !== null && timerLastTime !== prevLastTimeRef.current) {
      prevLastTimeRef.current = timerLastTime;
      setSelectedSolve(null); // Show new solve analysis instead of historical

      // Use the stable snapshot captured at stop time (avoids race with IDLE clearing)
      const moves = lastSolveMoves;
      const scr = scrambleAtSolveRef.current;
      const m = methodAtSolveRef.current;

      if (moves.length > 0) {
        // Defer to next tick to avoid blocking the UI
        setTimeout(() => {
          runAnalysis(moves, scr, m, lastSolveOrientations, lastSolveStartState ?? undefined).then((analysis) => {
            if (analysis) {
              lastSolveRef.current = { solve: null, analysis };
              setLastAnalysis(analysis);

              // Persist analysis to DB
              const solveId = pendingSolveIdRef.current;
              if (solveId) {
                updateSolve(solveId, { analysis }).catch(() =>
                  console.warn("Failed to persist analysis"),
                );
                pendingSolveIdRef.current = null;
              }
            }
          });
        }, 0);
      }
    }

    // Reset when going back to idle
    if (timerPhase === "idle") {
      prevLastTimeRef.current = null;
    }
  }, [timerLastTime, timerPhase, lastSolveMoves, lastSolveOrientations, lastSolveStartState, currentScramble, method]);

  const { remapScramble } = useOrientation();
  const displayScramble = remapScramble(currentScramble);

  // Refs so global shortcuts can read/act on the timer without re-rendering.
  const timerStateRef = useRef(timerPhase);
  const cancelRef = useRef<(() => void) | null>(null);

  const handleTimerCancel = useCallback(() => {
    timerCancel();
  }, [timerCancel]);

  const handleCopy = useCallback(async () => {
    const fail = () => toast.error("Couldn't copy scramble");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentScramble);
        toast.success("Scramble copied");
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = currentScramble;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) toast.success("Scramble copied");
      else fail();
    } catch {
      fail();
    }
  }, [currentScramble]);

  const handleCancelShortcut = useCallback(() => {
    timerCancel();
  }, [timerCancel]);

  const handleUpdate = useCallback(
    (id: string, updates: { penalty?: Penalty; note?: string | null }) => {
      updateSolve(id, updates).catch(() => toast.error("Update failed"));
    },
    [updateSolve],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteSolve(id).catch(() => toast.error("Delete failed"));
    },
    [deleteSolve],
  );

  const handleClear = useCallback(() => {
    clearSession().catch(() => toast.error("Couldn't clear session"));
  }, [clearSession]);

  const handleNewSession = useCallback(() => {
    newSession()
      .then(() => {
        setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
        setScrambleIndex(0);
        toast.success("New session started");
      })
      .catch(() => toast.error("Couldn't create session"));
  }, [newSession]);

  const handleSwitchSession = useCallback(
    (id: string) => {
      switchSession(id).catch(() => toast.error("Couldn't switch session"));
    },
    [switchSession],
  );

  useShortcuts({
    onNewScramble: handleRegenerate,
    onCopyScramble: handleCopy,
    onCancel: handleCancelShortcut,
    timerStateRef,
  });

  useEffect(() => {
    document.title = `cubeforge — ${solves.length} solves`;
  }, [solves.length]);

  const validSolves = solves.filter((s) => s.penalty !== "DNF");
  const currentPB =
    validSolves.length > 0
      ? Math.min(
          ...validSolves.map((s) =>
            s.time + (s.penalty === "+2" ? 2000 : 0),
          ),
        )
      : null;

  const timerStateRefValue = timerStateRef.current;
  const timerRunning =
    timerStateRefValue === "running" || timerStateRefValue === "ready";

  const scrollToTimer = useCallback(() => {
    document.getElementById("timer-section")?.scrollIntoView({
      behavior: "smooth",
    });
  }, []);

  // Create a solve object for the analysis panel — prefer selected, then last
  const solveForPanel = selectedSolve
    ? selectedSolve
    : lastAnalysis
      ? {
          id: "latest",
          time: timerLastTime ?? 0,
          penalty: "none" as Penalty,
          scramble: scrambleAtSolveRef.current || currentScramble,
          timestamp: Date.now(),
          method: methodAtSolveRef.current || methodPref,
          analysis: lastAnalysis,
        } satisfies import("@/types").Solve
      : undefined;

  return (
    <div className="antialiased bg-background text-foreground min-h-screen overflow-x-hidden">
      <ThemeProvider>
        <MainLayout
          pb={currentPB}
          sessionCount={solves.length}
          sessions={sessions}
          activeSessionId={session?.id ?? null}
          onSwitchSession={handleSwitchSession}
          onNewSession={handleNewSession}
          onRenameSession={renameSession}
          onDeleteSession={deleteSession}
          cube3DActive={cube3DActive}
          cube3DReady={cube3DReady}
          onToggleCube3D={() => {
            setCube3DActive((prev) => {
              if (!prev) setCube3DReady(true);
              return !prev;
            });
          }}
          sidebarActive={sidebarActive}
          onToggleSidebar={() => setSidebarActive((a) => !a)}
          cube3D={<Cube3DPanel />}
          leftSidebar={
            <LeftSidebar
              timerActive={timerRunning}
              onNavigateTimer={scrollToTimer}
              mobileOpen={mobileNavOpen}
              onMobileOpenChange={setMobileNavOpen}
            />
          }
          onToggleMobileNav={() => setMobileNavOpen((a) => !a)}
          main={
            <>
              {scrambleVerification && (
                <ScrambleDisplay
                  scramble={currentScramble}
                  displayScramble={displayScramble}
                  states={validation.states}
                  currentIndex={validation.currentIndex}
                  errorMoves={validation.displayErrorMoves}
                  pendingHalfDouble={validation.pendingHalfDouble}
                  isScrambled={validation.isScrambled}
                  needsReset={validation.needsReset}
                  awaitingSolve={validation.awaitingSolve}
                  onRegenerate={handleRegenerate}
                  onCopy={handleCopy}
                  indexLabel={`#${scrambleIndex + 1}`}
                />
              )}

              <TimerContainer
                phase={timerPhase}
                time={timerTime}
                lastTime={timerLastTime}
                hintCtx={{
                  smartCube: smartCubeConnected,
                  scrambleVerif: scrambleVerification,
                  inspection,
                  isScrambled: validation.isScrambled,
                }}
                onPress={timerPress}
                onRelease={timerRelease}
                onCancel={handleTimerCancel}
                stateRef={timerStateRef}
                cancelRef={cancelRef}
                className="mt-1 flex-1"
              />

              <SessionStats solves={solves} />
            </>
          }
          sidebar={
            <Tabs
              defaultValue="times"
              className="flex h-full min-h-0 flex-col gap-4"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="times" className="text-xs">
                  Times
                  {loading ? null : (
                    <span className="nums ml-1.5 text-[0.6rem] text-ink-3">
                      {solves.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="stats" className="text-xs">
                  Stats
                </TabsTrigger>
                <TabsTrigger value="analysis" className="text-xs">
                  Analysis
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="times"
                className="min-h-0 flex-1 flex flex-col"
              >
                <TimesList
                  solves={solves}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onClear={handleClear}
                  onSelect={setSelectedSolve}
                  className="h-[55vh] lg:h-full"
                />
              </TabsContent>

              <TabsContent
                value="stats"
                className="min-h-0 flex-1 overflow-y-auto pr-1"
              >
                <StatsPanel solves={solves} pb={currentPB ?? undefined} />
              </TabsContent>

              <TabsContent
                value="analysis"
                className="min-h-0 flex-1 overflow-y-auto pr-1"
              >
                {solveForPanel ? (
                  <SolveAnalysisPanel solve={solveForPanel} />
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1 py-16 text-center">
                    <p className="text-sm text-ink-2">No analysis yet</p>
                    <p className="text-xs text-ink-3">
                      Complete a solve with a Smart Cube to see your analysis.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          }
        />
        <Toaster position="bottom-center" richColors={false} />
      </ThemeProvider>
    </div>
  );
}
