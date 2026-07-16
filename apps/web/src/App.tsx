import { useCallback, useEffect, useRef, useState } from "react";
import { MainLayout } from "@/components/Layout/MainLayout";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { SessionStats } from "@/components/Stats/SessionStats";
import { TimesList } from "@/components/Stats/TimesList";
import { StatsPanel } from "@/components/Stats/StatsPanel";
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
import { useScrambleValidator } from "@/hooks/useScrambleValidator";
import { RandomStateGenerator, Min2PhaseSolver } from "@cubeforge/math-core";
import { ThemeProvider } from "@/components/theme-provider";
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

  const [scrambleIndex, setScrambleIndex] = useState(0);
  const [cube3DActive, setCube3DActive] = useState(false);
  const [cube3DReady, setCube3DReady] = useState(false);
  const [sidebarActive, setSidebarActive] = useState(true);
  const [currentScramble, setCurrentScramble] = useState(() => 
    RandomStateGenerator.generateScramble(new Min2PhaseSolver())
  );
  const handleRegenerate = useCallback(() => {
    setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
    setScrambleIndex((i) => i + 1);
    toast.success("New scramble");
  }, []);
  const {
    states: scrambleStates,
    isScrambled,
    currentIndex,
    errorMoves,
    pendingHalfDouble,
    needsReset,
    awaitingSolve,
  } = useScrambleValidator(currentScramble);

  // Refs so global shortcuts can read/act on the timer without re-rendering.
  const timerStateRef = useRef("idle");
  const cancelRef = useRef<(() => void) | null>(null);

  const handleComplete = useCallback(
    (time: number, penalty: "none" | "+2" | "DNF" = "none") => {
      addSolve({ time, scramble: currentScramble, penalty })
        .then(() => {
          setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
          setScrambleIndex((i) => i + 1);
        })
        .catch(() => toast.error("Couldn’t save solve"));
    },
    [addSolve, currentScramble],
  );

  const handleUpdate = useCallback(
    (id: string, updates: { penalty?: "none" | "+2" | "DNF"; note?: string | null }) => {
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
    clearSession().catch(() => toast.error("Couldn’t clear session"));
  }, [clearSession]);

  const handleCopy = useCallback(async () => {
    const fail = () => toast.error("Couldn’t copy scramble");
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

  const handleCancel = useCallback(() => {
    cancelRef.current?.();
  }, []);

  const handleNewSession = useCallback(() => {
    newSession().then(() => {
      setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
      setScrambleIndex(0);
      toast.success("New session started");
    }).catch(() => toast.error("Couldn’t create session"));
  }, [newSession]);

  const handleSwitchSession = useCallback(
    (id: string) => {
      switchSession(id).catch(() => toast.error("Couldn’t switch session"));
    },
    [switchSession],
  );

  useShortcuts({
    onNewScramble: handleRegenerate,
    onCopyScramble: handleCopy,
    onCancel: handleCancel,
    timerStateRef,
  });

  // Best-effort keep the document title in sync with session size.
  useEffect(() => {
    document.title = `cubeforge — ${solves.length} solves`;
  }, [solves.length]);

  const validSolves = solves.filter(s => s.penalty !== "DNF");
  const currentPB = validSolves.length > 0
    ? Math.min(...validSolves.map(s => s.time + (s.penalty === "+2" ? 2000 : 0)))
    : null;

  return (
    <div className="antialiased bg-background text-foreground min-h-screen">
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
            setCube3DActive(prev => {
              if (!prev) setCube3DReady(true);
              return !prev;
            });
          }}
          sidebarActive={sidebarActive}
          onToggleSidebar={() => setSidebarActive(a => !a)}
          cube3D={<Cube3DPanel />}
          main={
            <>
              <ScrambleDisplay
                scramble={currentScramble}
                states={scrambleStates}
                currentIndex={currentIndex}
                errorMoves={errorMoves}
                pendingHalfDouble={pendingHalfDouble}
                isScrambled={isScrambled}
                needsReset={needsReset}
                awaitingSolve={awaitingSolve}
                onRegenerate={handleRegenerate}
                onCopy={handleCopy}
                indexLabel={`#${scrambleIndex + 1}`}
              />

              <TimerContainer
                onComplete={handleComplete}
                stateRef={timerStateRef}
                cancelRef={cancelRef}
                isScrambled={isScrambled}
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
              <TabsList className="grid w-full grid-cols-2">
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
                  className="h-[55vh] lg:h-full"
                />
              </TabsContent>

              <TabsContent
                value="stats"
                className="min-h-0 flex-1 overflow-y-auto pr-1"
              >
                <StatsPanel solves={solves} pb={currentPB ?? undefined} />
              </TabsContent>
            </Tabs>
          }
        />
        <Toaster position="bottom-center" richColors={false} />
      </ThemeProvider>
    </div>
  );
}
