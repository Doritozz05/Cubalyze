"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Activity, Play, Square, Volume2, VolumeX, Minus, Plus, Music } from "lucide-react";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BeatIndicator } from "./BeatIndicator";
import { cn } from "@/lib/utils";

export interface FloatingMetronomePanelProps {
  className?: string;
}

export type SoundMode = "digital" | "wood" | "synth" | "bell";

const SOUND_MODES: { id: SoundMode; label: string }[] = [
  { id: "digital", label: "Beep" },
  { id: "wood", label: "Wood" },
  { id: "synth", label: "Synth" },
  { id: "bell", label: "Bell" },
];

const QUICK_TPS_PRESETS = [2.0, 4.0, 6.0, 8.0, 10.0, 12.0];

/**
 * Professional TPS Metronome Widget.
 * Supports direct TPS control (2.0 to 15.0 TPS) and customizable Sound Modes.
 */
export function FloatingMetronomePanel({ className }: FloatingMetronomePanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tps, setTps] = useState(3.0); // Default 3.0 TPS = 180 BPM
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [soundMode, setSoundMode] = useState<SoundMode>("digital");
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  // Derived BPM (1 TPS = 60 BPM)
  const bpm = Math.round(tps * 60);

  // Audio scheduler refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentBeatRef = useRef<number>(0);
  const timerIdRef = useRef<number | null>(null);

  // Keep state in refs for lock-free audio scheduler thread access
  const tpsRef = useRef(tps);
  tpsRef.current = tps;
  const beatsPerBarRef = useRef(beatsPerBar);
  beatsPerBarRef.current = beatsPerBar;
  const soundModeRef = useRef(soundMode);
  soundModeRef.current = soundMode;
  const volumeRef = useRef(isMuted ? 0 : volume);
  volumeRef.current = isMuted ? 0 : volume;

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  }, []);

  const playClick = useCallback((time: number, isAccent: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const mode = soundModeRef.current;
    const masterVol = volumeRef.current;
    if (masterVol <= 0) return;

    if (mode === "digital") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
      const gainVal = isAccent ? masterVol : masterVol * 0.7;
      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.04);
    } else if (mode === "wood") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      const startFreq = isAccent ? 600 : 450;
      const endFreq = isAccent ? 180 : 120;
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.03);
      gain.gain.setValueAtTime(masterVol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.035);
    } else if (mode === "synth") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(isAccent ? 1400 : 900, time);
      gain.gain.setValueAtTime(isAccent ? masterVol * 0.5 : masterVol * 0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.025);
    } else if (mode === "bell") {
      if (isAccent) {
        // High chime bell for Beat 1 accent
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = "sine";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(2093, time); // C7
        osc2.frequency.setValueAtTime(3136, time); // G7
        gain.gain.setValueAtTime(masterVol * 0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.12);
        osc2.stop(time + 0.12);
      } else {
        // Short mechanical tick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1000, time);
        gain.gain.setValueAtTime(masterVol * 0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.02);
      }
    }
  }, []);

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Lookahead window: 100ms
    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const beat = currentBeatRef.current;
      const isAccent = beatsPerBarRef.current > 1 && beat === 0;

      playClick(nextNoteTimeRef.current, isAccent);

      // Trigger UI beat update
      const beatForUI = beat;
      setTimeout(() => {
        setCurrentBeat(beatForUI);
      }, Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000));

      // Advance time by 1 beat duration in seconds (60 / BPM)
      const currentBpm = Math.round(tpsRef.current * 60);
      const secondsPerBeat = 60.0 / currentBpm;
      nextNoteTimeRef.current += secondsPerBeat;

      // Advance beat index
      currentBeatRef.current = (beat + 1) % beatsPerBarRef.current;
    }
  }, [playClick]);

  const startMetronome = useCallback(() => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    currentBeatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    setIsPlaying(true);

    if (timerIdRef.current !== null) {
      window.clearInterval(timerIdRef.current);
    }
    timerIdRef.current = window.setInterval(scheduler, 25);
  }, [initAudio, scheduler]);

  const stopMetronome = useCallback(() => {
    if (timerIdRef.current !== null) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  }, [isPlaying, startMetronome, stopMetronome]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIdRef.current !== null) {
        window.clearInterval(timerIdRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  return (
    <FloatingWidgetWrapper
      widgetId="metronome"
      icon={Activity}
      label="Metronome"
      panelWidth={280}
      defaultPosition={{ x: 920, y: 72 }}
      className={className}
    >
      <div className="p-3.5 space-y-3.5 w-full select-none text-ink">
        {/* Main Display: TPS & BPM */}
        <div className="flex items-center justify-between rounded-lg bg-surface-2 p-3 border border-line">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight font-mono text-accent">
                {tps.toFixed(1)}
              </span>
              <span className="text-xs text-accent font-extrabold font-mono">TPS</span>
            </div>
            <span className="text-[0.68rem] font-mono text-ink-3 font-medium">
              {bpm} BPM
            </span>
          </div>

          <Button
            onClick={togglePlay}
            size="icon"
            variant={isPlaying ? "destructive" : "default"}
            className={cn(
              "size-11 rounded-full shadow-sm transition-all duration-150 active:scale-95",
              !isPlaying && "bg-accent hover:bg-accent/90 text-white",
            )}
            aria-label={isPlaying ? "Stop metronome" : "Start metronome"}
          >
            {isPlaying ? (
              <Square className="size-4.5 fill-current" />
            ) : (
              <Play className="size-4.5 fill-current ml-0.5" />
            )}
          </Button>
        </div>

        {/* Visual Beat Indicator Dots */}
        <BeatIndicator
          beatsPerBar={beatsPerBar}
          currentBeat={currentBeat}
          isPlaying={isPlaying}
        />

        {/* TPS Slider (2.0 to 15.0 TPS) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-2">
            <span className="font-semibold text-ink">TPS Target (2 – 15)</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTps((t) => Math.max(2.0, Math.round((t - 0.5) * 10) / 10))}
                className="h-6 px-1.5 py-0 text-[0.62rem] font-mono"
              >
                -0.5
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTps((t) => Math.max(2.0, Math.round((t - 0.1) * 10) / 10))}
                className="h-6 w-6 p-0"
              >
                <Minus className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTps((t) => Math.min(15.0, Math.round((t + 0.1) * 10) / 10))}
                className="h-6 w-6 p-0"
              >
                <Plus className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTps((t) => Math.min(15.0, Math.round((t + 0.5) * 10) / 10))}
                className="h-6 px-1.5 py-0 text-[0.62rem] font-mono"
              >
                +0.5
              </Button>
            </div>
          </div>
          <Slider
            min={2.0}
            max={15.0}
            step={0.1}
            value={[tps]}
            onValueChange={(val) => val[0] !== undefined && setTps(val[0])}
            className="w-full py-1"
          />
        </div>

        {/* Quick TPS Presets */}
        <ToggleGroup
          type="single"
          value={tps.toFixed(1)}
          onValueChange={(val) => val && setTps(parseFloat(val))}
          className="w-full grid grid-cols-6 gap-1"
        >
          {QUICK_TPS_PRESETS.map((preset) => (
            <ToggleGroupItem
              key={preset}
              value={preset.toFixed(1)}
              variant="outline"
              size="sm"
              className={cn(
                "h-7 px-0 text-[0.62rem] font-mono font-medium transition-colors text-center data-[variant=outline]:border-l",
                Math.abs(tps - preset) < 0.05
                  ? "bg-surface-2 border-ink/30 text-ink font-semibold"
                  : "bg-surface border-line text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              {preset}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Sound Preset Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[0.68rem] font-semibold text-ink-2">
            <Music className="size-3 text-ink-2" />
            <span>Sound Mode</span>
          </div>
          <ToggleGroup
            type="single"
            value={soundMode}
            onValueChange={(val) => val && setSoundMode(val as SoundMode)}
            className="w-full grid grid-cols-4 gap-1"
          >
            {SOUND_MODES.map((mode) => (
              <ToggleGroupItem
                key={mode.id}
                value={mode.id}
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 px-1 text-[0.62rem] font-medium transition-colors text-center data-[variant=outline]:border-l",
                  soundMode === mode.id
                    ? "bg-ink text-surface border-ink font-bold"
                    : "bg-surface border-line text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {mode.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Beats Per Bar & Volume Row */}
        <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-ink-3 text-[0.68rem]">Accent:</span>
            <ToggleGroup
              type="single"
              value={beatsPerBar.toString()}
              onValueChange={(val) => val && setBeatsPerBar(parseInt(val, 10))}
              className="flex gap-1"
            >
              {[1, 2, 3, 4].map((count) => (
                <ToggleGroupItem
                  key={count}
                  value={count.toString()}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "size-6 p-0 text-[0.62rem] font-mono flex items-center justify-center border data-[variant=outline]:border-l",
                    beatsPerBar === count
                      ? "bg-ink text-surface border-ink font-bold"
                      : "bg-surface text-ink-2 border-line hover:bg-surface-2",
                  )}
                >
                  {count}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
              className="h-6 w-6 p-0 text-ink-2 hover:text-ink transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="size-3.5 text-rose-500" />
              ) : (
                <Volume2 className="size-3.5" />
              )}
            </Button>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[isMuted ? 0 : volume]}
              onValueChange={(val) => {
                if (val[0] !== undefined) {
                  setVolume(val[0]);
                  if (isMuted) setIsMuted(false);
                }
              }}
              className="w-16"
            />
          </div>
        </div>
      </div>
    </FloatingWidgetWrapper>
  );
}
