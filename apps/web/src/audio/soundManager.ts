/**
 * SoundManager — professional Web Audio manager (AAA techniques).
 *
 * Owns the ENTIRE Web Audio graph of the app so every subsystem shares one
 * AudioContext, one master volume and one mixer. Consumed by
 * `utils/cubeTurnSounds.ts` (cube turn SFX) and `utils/audioSystem.ts`
 * (PB fanfare). The inspection TTS stays on the Web Speech API (not Web
 * Audio) and the metronome keeps its own precision scheduler — both are out
 * of scope by design.
 *
 * ── AAA techniques ─────────────────────────────────────────────────────────
 *   *   • ONE shared AudioContext for the whole app — one device open, one
   *     clock, one volume. `armForUserGesture()` attaches the unlock hooks
   *     at APP STARTUP (App.tsx) so the FIRST gesture anywhere — not just
   *     on the cube — resumes it, and `warmOnLoad()` pre-creates the
   *     context in idle time right after first paint (creation needs no
   *     gesture; only playback does). Measured on Chromium: the first
   *     AudioContext of a page blocks ~0.5 s at construction and its
   *     `currentTime` can stay frozen ~1 s while the output device opens —
   *     but the device is opened AT construction and held while the context
   *     has never rendered, so a context pre-created at load makes the
   *     first gesture's resume() cost ~30 ms instead of the full cold
   *     start. That keeps the user's first cube turn from paying the ~1 s
   *     "sound comes out a second later" delay.
 *   • PRE-DECODED ASSET BANK without a gesture: `preload()` fetches the
 *     sample bytes AND decodes them through an `OfflineAudioContext`
 *     (`decodeAudioData` works on offline contexts with no user gesture —
 *     they are not audio devices, so autoplay never applies). Decoded
 *     `AudioBuffer`s are plain PCM and portable to the live context. This
 *     kills the first-move latency: on the first turn the buffers are
 *     already decoded, so the click fires on the exact move — no decode
 *     wait, no queue. (The old system decoded only on the first gesture,
 *     so the very first turn was always the latest one — the bug this
 *     manager exists to fix.)
 *   • MIXER BUSES + SAFETY LIMITER: master → DynamicsCompressorNode →
 *     destination, with per-category bus gains (`sfx`, `ui`) feeding the
 *     master. The compressor is the classic game-audio anti-clipping
 *     guard when one-shots overlap (rapid turns). Master gain follows the
 *     app's `soundVolume` preference (0–100) via `setMasterVolume`.
 *   • CLICK-FREE ENVELOPES: every voice ramps in over ~3 ms (attack) and,
 *     when stopped, ramps out (release) instead of snapping — eliminates
 *     the tiny DC clicks of raw `gain.value` switching.
 *   • RANDOMIZATION AGAINST REPETITION FATIGUE: per-play pitch jitter
 *     (±4% default at the caller) and volume jitter (±5%), plus
 *     no-repeat sample selection at the caller — the standard AAA
 *     anti-"machine-gun" treatment.
 *   • PRIORITY VOICE LIMITING: a cap on concurrent voices (24 default);
 *     when exceeded, the lowest-priority (then oldest) voice is faded out
 *     and recycled. Fast keyboard turns never pile up voices.
 *   • STEREO PAN (optional): `opts.pan` routes a voice through a
 *     StereoPannerNode (guarded — skipped where unsupported). Cube turns
 *     stay centered; the option exists for future spatialization.
 *   • LATENCY COMPENSATION: `getLatencyMs()` reports `baseLatency` +
 *     `outputLatency`, and `playFanfare()` schedules its arpeggio ahead of
 *     the output latency so the first note lands on the speakers exactly
 *     when the fanfare "starts".
 *   • DETERMINISTIC PLAYBACK — a cue is never fired into a frozen audio
 *     clock. Browsers pause the context while the tab is hidden, and on
 *     return Chromium can flip the context back to 'running' while the
 *     device is still reopening — currentTime stays frozen for up to ~1 s
 *     (crbug.com/41302928). Firing on that frozen clock is the "sound
 *     comes out a while later" bug. So playback is gated on the clock
 *     DEMONSTRABLY advancing (`clockSettled`): once the clock has ticked,
 *     the warm path fires voices with ZERO added latency; after a
 *     resume/device-reopen, cues wait for the first tick (the earliest
 *     possible moment, by construction). The eager resume hooks
 *     (visibilitychange → focus → first pointermove, plus the first
 *     gesture anywhere) start the device reopen BEFORE the user reaches
 *     the cube, so the gate rarely adds anything.
 *
 * ── Contract ───────────────────────────────────────────────────────────────
 *
 *   • `preload()` is fully lazy and safe to call on mount: it fetches +
 *     decodes in the background and never touches the live context.
 *   • `play()` creates the live context if missing (a turn IS a gesture in
 *     the app), queues cues whose sample is still loading, and plays
 *     immediately once buffers are ready and the clock provably advances.
 *   • Sounds gated by app preferences live in the callers
 *     (`cubeTurnSounds.play()` reads Settings → Audio); the manager only
 *     implements volume.
 */

/** Mixer buses. Each is a GainNode feeding the master; the master feeds the
 *  compressor. New categories (music, voice) slot in here. */
export type BusId = "sfx" | "ui";

const BUS_IDS: BusId[] = ["sfx", "ui"];

/** A named sample the manager can fetch + decode on demand. */
export interface AssetDescriptor {
  id: string;
  url: string;
}

export interface PlayOptions {
  /** Per-voice gain multiplier 0..1 (multiplied by bus + master gain). */
  volume?: number;
  /** Base playbackRate (1 = as recorded). */
  pitch?: number;
  /** Random jitter around the base values (AAA anti-repetition fatigue):
   *  `pitch` and `volume` are the max ± deviation (e.g. 0.04 → ±4%). */
  jitter?: { pitch?: number; volume?: number };
  /** Stereo pan -1 (left) .. 1 (right). Centered when omitted. */
  pan?: number;
  /** Mixer bus. Default "sfx". */
  bus?: BusId;
  /** Click-free attack ramp in ms. Default 3. */
  attackMs?: number;
  /** Release ramp in ms applied by `stop()`. Default 12. */
  releaseMs?: number;
  /** Voice priority — higher survives voice stealing. Default 0. */
  priority?: number;
  /** Fired when the voice finishes (naturally or via stop()). */
  onEnded?: () => void;
}

export interface FanfareOptions {
  /** Per-note duration in seconds. Default 0.12. */
  noteDuration?: number;
  /** Note spacing in seconds. Default 0.08. */
  stagger?: number;
  /** Peak gain of each note (0..1). Default 0.22. */
  volume?: number;
  /** Mixer bus. Default "ui". */
  bus?: BusId;
}

/** A cue waiting for its sample to decode or the audio clock to advance. */
interface PendingCue {
  id: string;
  opts: PlayOptions;
}

interface Voice {
  id: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
  priority: number;
  /** Monotonic creation order — used as the age tie-break for stealing. */
  startedAt: number;
  releaseMs: number;
}

/** Gestures that unlock autoplay-suspended AudioContexts. The pointerdown /
 *  touchstart / keydown trio covers modern browsers; `mousedown`/`click`
 *  cover browsers without Pointer Events (Safari < 13) and assistive tech.
 *  The listeners self-remove after the first gesture. */
const UNLOCK_GESTURES = ["pointerdown", "mousedown", "touchstart", "keydown", "click"] as const;

/** Window/document shape used by the resume hooks (browser + test stubs). */
type AudioRoot = {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  OfflineAudioContext?: typeof OfflineAudioContext;
  document?: {
    hidden: boolean;
    addEventListener: (type: string, listener: () => void) => void;
  };
  addEventListener: (type: string, listener: () => void, options?: { passive?: boolean }) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export class SoundManager {
  /** The single shared live context (created on the first user gesture). */
  private ctx: AudioContext | null = null;
  private offlineContext: OfflineAudioContext | null | undefined;
  private masterGain: GainNode | null = null;
  private readonly busGains = new Map<BusId, GainNode>();
  /** Decoded samples by asset id (null = definitively failed). */
  private readonly buffers = new Map<string, AudioBuffer | null>();
  /** Fetched sample bytes (decode deferred or re-decodable). */
  private readonly raw = new Map<string, ArrayBuffer>();
  /** Assets whose fetch or decode definitively failed — cues are dropped. */
  private readonly failed = new Set<string>();
  /** Raw bytes present but not yet decoded (no offline support / offline
   *  decode failed) — decoded lazily on the live context. */
  private readonly pendingDecode = new Set<string>();
  /** Fetch/decode in flight per asset (idempotent preload guard). */
  private readonly inflight = new Set<string>();
  /** Cues waiting for decode completion or the clock to advance. */
  private pending: PendingCue[] = [];
  /** Bumped on every drain attempt so stale clock-wait polls are no-ops. */
  private drainToken = 0;
  /**
   * Whether the audio clock has EVER demonstrably advanced since the last
   * resume/suspension. `true` ⇒ the warm path fires voices directly with
   * zero added latency; `false` ⇒ cues go through the clock gate so a
   * frozen clock (device reopening after a hidden tab) never swallows them.
   */
  private clockSettled = false;
  /** Whether the context has ever reached 'running' (a gesture unlocked it).
   *  Non-gesture resume hooks only act when this is true — calling resume()
   *  before the first gesture is REJECTED and Chrome logs "The AudioContext
   *  was not allowed to start" on every call. */
  private everRan = false;
  /** A resume() is already in flight (device reopening) — guards against
   *  stacking redundant resume() calls while one is pending. */
  private resumeInFlight = false;
  /** Whether the one-time gesture/resume hooks are attached. */
  private hooksArmed = false;
  /** Whether the first-signal warm-up listeners are attached. */
  private signalWarmupArmed = false;
  private voiceCounter = 0;
  private readonly voices = new Map<number, Voice>();
  private readonly maxVoices: number;
  private masterVolume = 80;

  constructor(maxVoices = 24) {
    this.maxVoices = maxVoices;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Attach the global first-gesture unlock + resume hooks at APP STARTUP
   * (call from the app root, both PWA and desktop). Zero audio work happens
   * until the FIRST trusted user gesture anywhere in the app — but that
   * gesture then creates the shared AudioContext and starts opening the
   * audio device in the background.
   *
   * Why this matters (measured): Chrome's FIRST AudioContext of a session
   * blocks the main thread for ~0.5 s during construction and then keeps
   * `currentTime` frozen at 0 for up to ~1 s while the output device opens
   * (state 'running', clock not advancing). A source started during that
   * window cannot produce sound — the device physically is not rendering
   * yet. The old code armed these hooks only when the cube view mounted, so
   * the user's FIRST cube turn was usually the very first gesture of the
   * app — and it paid the full ~1 s cold-start on the move itself ("el
   * primer move no es exacto"). Arming app-wide moves the cold start to the
   * earliest possible moment: by the time the user reaches the cube, the
   * device is warm and the first turn clicks instantly (warm context:
   * creation ~15 ms, sound ~0 ms added latency).
   */
  public armForUserGesture(): void {
    this.armHooks();
  }

  /**
   * Pre-create the shared AudioContext at APP STARTUP — deferred past first
   * paint — so the audio device is already open when the user's first
   * gesture arrives. CREATION needs no user gesture (autoplay only blocks
   * playback), and measured on Chromium: the output device is opened during
   * construction and HELD while the context has never rendered, so the
   * first gesture's `resume()` costs ~30 ms instead of the ~1 s cold start
   * (construction ~0.5 s main-thread block + `currentTime` frozen ~1 s)
   * that otherwise lands exactly on the user's first cube turn.
   *
   * Fallback (inherent): if the browser refuses the early context or closes
   * the idle device, `ensureContext()` is idempotent and the first-gesture
   * unlock + clock gate take over — the first turn simply waits for the
   * device like before. Nothing breaks.
   */
  public warmOnLoad(): void {
    // Defer: constructing the first AudioContext of a page blocks the main
    // thread ~0.5 s (measured), so run it in idle time rather than delaying
    // the initial render. `ensureContext()` is idempotent — if a gesture
    // already created it, this is a no-op.
    const create = () => {
      this.ensureContext();
    };
    if (typeof requestIdleCallback === "function") {
      // `timeout` is REQUIRED: without it Chromium may defer the callback
      // indefinitely while the page is busy (measured: never fired within
      // 8 s on a cache-miss hard reload), leaving the first move cold.
      requestIdleCallback(create, { timeout: 800 });
    } else {
      setTimeout(create, 800);
    }
    // Belt-and-suspenders: also create on the FIRST user signal — mouse
    // move, touch, key, scroll — which fires even while the load is still
    // busy, so an interaction before the idle callback never pays the cold
    // start (see armSignalWarmup).
    this.armSignalWarmup();
  }

  /**
   * Warm the asset bank: fetch + decode every sample with NO user gesture
   * (via OfflineAudioContext), so the first turn after mounting plays
   * instantly. Safe to call repeatedly and from mount. Also arms the
   * gesture/resume hooks (they do not touch audio until the first gesture).
   */
  public preload(assets: AssetDescriptor[]): Promise<void> {
    this.armHooks();
    const tasks = assets.map(async ({ id, url }) => {
      // Already decoded / failed / fetching / has raw bytes (decode pending).
      if (this.buffers.has(id) || this.raw.has(id) || this.inflight.has(id)) return;
      this.inflight.add(id);
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.raw.set(id, arrayBuffer);
        await this.tryDecode(id);
        if (!this.buffers.has(id) && !this.failed.has(id)) this.pendingDecode.add(id);
      } catch {
        // Fetch failed — the asset stays silent; drop cues waiting on it.
        this.fail(id);
      } finally {
        this.inflight.delete(id);
      }
    });
    return Promise.all(tasks).then(() => {
      this.drainPending();
    });
  }

  /**
   * Play a registered one-shot sample. Warm path (clock provably advancing):
   * fires the voice immediately — the exactness guarantee. Cold path (first
   * gesture, or just returned from a hidden tab): queues the cue behind the
   * clock gate, which fires it at the earliest moment the clock ticks.
   */
  public play(id: string, opts: PlayOptions = {}): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const buffer = this.buffers.get(id);
    if (!buffer) {
      if (this.failed.has(id)) return;
      // Never registered (no preload) and nothing loading — stay silent.
      if (!this.raw.has(id) && !this.inflight.has(id)) return;
      // Sample still loading/decoding — queue; the decode-completion path
      // drains (never fire into a not-yet-decoded buffer).
      this.pending.push({ id, opts });
      if (this.pendingDecode.has(id) && this.ctx) void this.decodePending();
      return;
    }

    if (ctx.state === "running" && this.clockSettled && !this.resumeInFlight) {
      // Warm path — zero added latency. This is the branch that makes the
      // FIRST move sound exactly on the move (the original bug: the first
      // turn queued behind a decode that only started on the first gesture).
      this.startSource(buffer, opts);
      return;
    }

    this.pending.push({ id, opts });
    this.drainPending();
  }

  /** Fade a voice out (release ramp) and stop it. Used by voice stealing. */
  public stop(voiceId: number): void {
    const voice = this.voices.get(voiceId);
    if (!voice) return;
    const now = this.ctx ? this.ctx.currentTime : 0;
    const release = voice.releaseMs / 1000;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0.0001, now + release);
      voice.source.stop(now + release + 0.02);
    } catch {
      // Node already stopped/closed — nothing left to fade.
    }
  }

  /** Master volume 0–100 (the Settings → Audio `soundVolume` preference).
   *  Smoothly ramps the master bus so volume changes never click. */
  public setMasterVolume(value: number): void {
    this.masterVolume = clamp(value, 0, 100);
    const gain = this.masterGain;
    if (!gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    gain.gain.setTargetAtTime(this.masterVolume / 100, now, 0.01);
    gain.gain.value = this.masterVolume / 100;
  }

  /** Per-bus gain 0..1 (e.g. ducking a category). */
  public setBusGain(bus: BusId, value: number): void {
    const gain = this.busGains.get(bus);
    if (!gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    gain.gain.setTargetAtTime(clamp(value, 0, 1), now, 0.01);
    gain.gain.value = clamp(value, 0, 1);
  }

  /** Temporarily duck a bus to `level` (0..1), restoring it after `holdMs`.
   *  The fanfare ducks the SFX bus so the chime cuts through. */
  public duck(bus: BusId, level: number, holdMs: number): void {
    const ctx = this.ctx;
    const gain = this.busGains.get(bus);
    if (!ctx || !gain) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(clamp(level, 0, 1), ctx.currentTime, 0.02);
    setTimeout(() => {
      const g = this.busGains.get(bus);
      if (!this.ctx || !g) return;
      g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
    }, holdMs);
  }

  /** End-to-end output latency in ms (baseLatency + outputLatency). */
  public getLatencyMs(): number {
    return Math.round(this.getLatencySeconds() * 1000);
  }

  /**
   * Synthesized one-shot fanfare (oscillators + ADSR envelopes) through the
   * shared graph — no per-play AudioContext creation. The arpeggio is
   * scheduled ahead of the output latency so the first note lands on the
   * speakers exactly when the fanfare "starts". Ducks the SFX bus while it
   * plays (sidechain-style).
   */
  public playFanfare(
    frequencies: number[],
    opts: FanfareOptions = {},
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const bus = this.busGains.get(opts.bus ?? "ui") ?? this.masterGain;
    if (!bus) return;

    const noteDuration = opts.noteDuration ?? 0.12;
    const stagger = opts.stagger ?? 0.08;
    const peak = clamp(opts.volume ?? 0.22, 0, 1);
    const start = ctx.currentTime + this.getLatencySeconds();
    try {
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === frequencies.length - 1 ? "sine" : "triangle";
        const t = start + idx * stagger;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + noteDuration + 0.35);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(t);
        osc.stop(t + noteDuration + 0.4);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            // Already disconnected — ignore.
          }
        };
      });
    } catch {
      // Node creation can fail if the context was closed — stay silent.
      return;
    }
    this.duck("sfx", 0.35, Math.round((noteDuration + stagger * frequencies.length) * 1000));
  }

  // ── Playback internals ───────────────────────────────────────────────────

  /** Fire one decoded sample through the graph as a one-shot voice. */
  private startSource(buffer: AudioBuffer, opts: PlayOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // Voice limiting first: the incoming voice must be able to get a slot.
    if (!this.enforceVoiceLimit(opts.priority ?? 0)) return;

    const voiceId = ++this.voiceCounter;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const pitch = Math.max(0.5, (opts.pitch ?? 1) * (1 + this.jitterFor(opts.jitter?.pitch)));
    source.playbackRate.value = pitch;

    const gain = ctx.createGain();
    const volume = clamp((opts.volume ?? 1) * (1 + this.jitterFor(opts.jitter?.volume)), 0, 1);
    const now = ctx.currentTime;
    const attack = (opts.attackMs ?? 3) / 1000;
    // Click-free envelope: ramp in over `attack`, never a raw step.
    gain.gain.value = volume;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(Math.max(volume, 0.0001), now + attack);

    source.connect(gain);
    const bus = this.busGains.get(opts.bus ?? "sfx") ?? this.masterGain;
    if (!bus) return;
    if (opts.pan !== undefined && typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(opts.pan, -1, 1);
      gain.connect(panner);
      panner.connect(bus);
    } else {
      gain.connect(bus);
    }
    source.start();

    this.voices.set(voiceId, {
      id: voiceId,
      source,
      gain,
      priority: opts.priority ?? 0,
      startedAt: voiceId,
      releaseMs: (opts.releaseMs ?? 12),
    });

    // One-shot nodes must be disconnected after playback or they leak.
    source.onended = () => {
      this.voices.delete(voiceId);
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // Already disconnected — ignore.
      }
      opts.onEnded?.();
    };
  }

  /** Random deviation within ±`amount` (0 when omitted). */
  private jitterFor(amount: number | undefined): number {
    return amount ? amount * (Math.random() * 2 - 1) : 0;
  }

  /**
   * Enforce the concurrent-voice cap: when full, fade out the
   * lowest-priority (then oldest) voice to make room. Returns false when the
   * incoming voice itself is the lowest priority — it is dropped instead.
   */
  private enforceVoiceLimit(priority: number): boolean {
    if (this.voices.size < this.maxVoices) return true;
    let victim: Voice | null = null;
    for (const voice of this.voices.values()) {
      if (
        !victim ||
        voice.priority < victim.priority ||
        (voice.priority === victim.priority && voice.startedAt < victim.startedAt)
      ) {
        victim = voice;
      }
    }
    if (victim && victim.priority <= priority) {
      this.stop(victim.id);
      return true;
    }
    return false;
  }

  // ── Deterministic clock gate ─────────────────────────────────────────────

  /**
   * Drain every cue that can fire. Gated on the clock DEMONSTRABLY
   * advancing — never on `state === 'running'` alone, because Chromium
   * resolves resume() and flips the state back to 'running' while the audio
   * device is still reopening (currentTime frozen up to ~1 s,
   * crbug.com/41302928). Cues whose sample is still decoding stay queued —
   * the preload/decode-completion path re-drains them (no spin here).
   */
  private drainPending(): void {
    if (this.pending.length === 0 || !this.ctx) return;
    const ctx = this.ctx;

    if (ctx.state !== "running") {
      void this.resumeAndDrain();
      return;
    }

    const token = ++this.drainToken;
    const baseline = ctx.currentTime;

    const poll = () => {
      if (token !== this.drainToken || this.pending.length === 0) return;
      if (ctx.currentTime > baseline) {
        // The clock provably advanced — from now on the warm path is safe.
        this.clockSettled = true;
        const ready: PendingCue[] = [];
        const rest: PendingCue[] = [];
        for (const cue of this.pending) {
          (this.buffers.get(cue.id) ? ready : rest).push(cue);
        }
        this.pending = rest;
        for (const cue of ready) {
          const buffer = this.buffers.get(cue.id);
          if (buffer) this.startSource(buffer, cue.opts);
        }
      } else if (ctx.state !== "running") {
        // Context paused mid-wait (tab hidden again) — the resume path
        // re-drains when it runs.
        void this.resumeAndDrain();
      } else {
        // Clock still frozen (device reopening) — check again shortly.
        setTimeout(poll, 8);
      }
    };
    poll();
  }

  /**
   * Bring a non-running context back to `running` and drain queued cues once
   * it is. Handles BOTH paused states Web Audio defines: `suspended`
   * (autoplay block / hidden-tab freeze) and `interrupted` (iOS Safari
   * backgrounding — MDN documents resume() as the fix). A resume() without
   * user activation REJECTS (and a not-allowed-to-start resume may HANG,
   * WebAudio spec #1759): cues stay queued and the next gesture /
   * visibilitychange retries — a click is never lost to a swallowed
   * rejection.
   */
  private resumeAndDrain(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve();
    if (ctx.state === "running") {
      this.drainPending();
      return Promise.resolve();
    }
    if (this.resumeInFlight) return Promise.resolve();
    this.resumeInFlight = true;
    this.clockSettled = false;
    return ctx
      .resume()
      .then(() => {
        this.resumeInFlight = false;
        this.drainPending();
        // Warm the settled flag eagerly so the first cue after the reopen
        // takes the zero-latency path (see observeClock).
        this.observeClock();
      })
      .catch(() => {
        this.resumeInFlight = false;
      });
  }

  /**
   * Eagerly observe the clock advancing with no pending cues: after a
   * context starts or a resume completes, a short poll marks `clockSettled`
   * the moment currentTime ticks. This is what lets the FIRST move after a
   * gesture play with zero added latency — the gate is only ever exercised
   * while the device is genuinely reopening.
   */
  private observeClock(): void {
    if (this.clockSettled || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const baseline = ctx.currentTime;
    const check = () => {
      if (this.ctx !== ctx || this.clockSettled) return;
      if (ctx.state !== "running") return;
      if (ctx.currentTime > baseline) this.clockSettled = true;
      else setTimeout(check, 8);
    };
    setTimeout(check, 8);
  }

  // ── Context / asset lifecycle ────────────────────────────────────────────

  /** Create the shared live context on the FIRST user gesture (autoplay
   *  policy forbids creating it earlier), build the mixer graph, kick the
   *  lazy decode of any asset that only had raw bytes, and arm the hooks. */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;

    const root = this.getRoot();
    const Ctor = root.AudioContext ?? root.webkitAudioContext;
    if (!Ctor) return null;

    try {
      this.ctx = new Ctor();
    } catch {
      // Context creation can fail (browser limit / unavailable) — stay silent.
      return null;
    }
    this.clockSettled = false;
    this.ensureGraph();
    this.ctx.onstatechange = () => {
      if (!this.ctx) return;
      if (this.ctx.state === "running") {
        // A gesture unlocked the context — the non-gesture hooks may resume
        // eagerly from now on.
        this.everRan = true;
        this.drainPending();
        this.observeClock();
      } else {
        this.clockSettled = false;
      }
    };
    // The live context exists now — decode assets that were waiting for it.
    void this.decodePending();
    this.armHooks();
    return this.ctx;
  }

  /** Build master → compressor → destination with per-bus gains. */
  private ensureGraph(): void {
    if (this.masterGain || !this.ctx) return;
    const ctx = this.ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 20;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    const master = ctx.createGain();
    master.gain.value = this.masterVolume / 100;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    this.masterGain = master;
    for (const bus of BUS_IDS) {
      const gain = ctx.createGain();
      gain.gain.value = 1;
      gain.connect(master);
      this.busGains.set(bus, gain);
    }
  }

  /** The offline context used to decode WITHOUT a user gesture. Created once,
   *  lazily; `null` when unsupported (older browsers) — the live context
   *  fallback then covers decode. */
  private getOfflineContext(): OfflineAudioContext | null {
    if (this.offlineContext !== undefined) return this.offlineContext;
    const Ctor = this.getRoot().OfflineAudioContext;
    if (!Ctor) {
      this.offlineContext = null;
      return null;
    }
    try {
      this.offlineContext = new Ctor(1, 1, 48000);
    } catch {
      this.offlineContext = null;
    }
    return this.offlineContext;
  }

  /** Decode `id`'s raw bytes with whichever decoder is available: offline
   *  first (no gesture needed), then the live context. Leaves the asset
   *  undecoded when neither exists yet — the caller marks it pending. */
  private async tryDecode(id: string): Promise<void> {
    const ab = this.raw.get(id);
    if (!ab || this.buffers.get(id)) return;

    const offline = this.getOfflineContext();
    if (offline) {
      try {
        this.buffers.set(id, await offline.decodeAudioData(ab));
        return;
      } catch {
        // Offline decode failed — fall back to the live context.
      }
    }

    const ctx = this.ctx;
    if (ctx) {
      try {
        this.buffers.set(id, await ctx.decodeAudioData(ab));
        this.pendingDecode.delete(id);
        return;
      } catch {
        this.fail(id);
        return;
      }
    }
    // No live context yet (no gesture) and no offline support — deferred.
    this.pendingDecode.add(id);
  }

  /** Decode every deferred asset on the live context (fallback path). */
  private async decodePending(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const ids = [...this.pendingDecode];
    for (const id of ids) {
      if (this.buffers.has(id)) {
        this.pendingDecode.delete(id);
        continue;
      }
      const ab = this.raw.get(id);
      if (!ab) continue;
      try {
        this.buffers.set(id, await ctx.decodeAudioData(ab));
        this.pendingDecode.delete(id);
      } catch {
        this.fail(id);
      }
    }
    this.drainPending();
  }

  /** Mark an asset failed and drop any cues waiting on it (stay silent). */
  private fail(id: string): void {
    this.failed.add(id);
    this.buffers.set(id, null);
    this.pendingDecode.delete(id);
    this.pending = this.pending.filter((cue) => cue.id !== id);
  }

  /**
   * Create the context on the FIRST user signal (any activity — pointer
   * move, touch, key, scroll), independent of requestIdleCallback. CREATION
   * needs no user gesture (autoplay only blocks playback), and the signal
   * listener self-removes after the first hit. This closes the hard-reload
   * race: on a slow cache-miss load the idle callback may never fire before
   * the user interacts, and this listener catches the very first mouse
   * movement (which precedes any drag/key turn) so the cold construction
   * happens during the approach, not on the move.
   */
  private armSignalWarmup(): void {
    if (this.signalWarmupArmed) return;
    this.signalWarmupArmed = true;
    const root = this.getRoot();
    if (typeof root.addEventListener !== "function") return;
    const signals = ["pointermove", "mousemove", "touchstart", "pointerdown", "keydown", "scroll"] as const;
    const warm = () => {
      this.ensureContext();
      for (const type of signals) root.removeEventListener(type, warm);
    };
    for (const type of signals) {
      root.addEventListener(type, warm, { passive: true });
    }
  }

  // ── Resume hooks ─────────────────────────────────────────────────────────

  /**
   * Attach the deterministic resume hooks once. The device-reopen work
   * starts at the EARLIEST signal after the user returns (visibilitychange →
   * focus → first pointermove), so the ~0.5-1 s reopen overlaps with the
   * user approaching the cube instead of with the turn:
   *   1. `visibilitychange` → resume as soon as the tab becomes visible again.
   *   2. `focus` → resume when the window regains focus.
   *   3. `pointermove` (permanent, guarded) → resume on the first mouse
   *      movement after returning, before the actual layer drag.
   *   4. First gesture (pointer/key/touch) anywhere → unlocks the
   *      autoplay-suspended context and self-removes afterwards.
   */
  private armHooks(): void {
    if (this.hooksArmed) return;
    this.hooksArmed = true;

    const root = this.getRoot();
    const doc = root.document;
    if (doc && typeof doc.addEventListener === "function") {
      doc.addEventListener("visibilitychange", () => {
        // Only resume a context the user has already unlocked — before the
        // first gesture Chrome REJECTS resume() and logs "The AudioContext
        // was not allowed to start" for every call.
        if (!doc.hidden && this.everRan) void this.resumeAndDrain();
      });
    }

    if (typeof root.addEventListener === "function") {
      root.addEventListener("focus", () => {
        if (this.everRan) void this.resumeAndDrain();
      });

      const onMove = () => {
        if (this.ctx && this.ctx.state !== "running" && this.everRan) {
          void this.resumeAndDrain();
        }
      };
      root.addEventListener("pointermove", onMove, { passive: true });
      // Fallback for browsers without Pointer Events (Safari < 13).
      root.addEventListener("mousemove", onMove, { passive: true });

      // The FIRST real gesture (pointer/key/touch/click) unlocks the
      // autoplay-suspended context and self-removes afterwards. (No
      // warm-keep media loop: the background audio it played to keep the OS
      // device open was audible and annoying — playback simply waits for the
      // clock-gated resume on the first cue after a pause.)
      const unlock = () => {
        this.ensureContext();
        void this.resumeAndDrain();
        for (const type of UNLOCK_GESTURES) {
          root.removeEventListener(type, unlock);
        }
      };
      for (const type of UNLOCK_GESTURES) {
        root.addEventListener(type, unlock, { passive: true });
      }
    }
  }

  private getRoot(): AudioRoot {
    return (typeof window !== "undefined" ? window : globalThis) as AudioRoot;
  }

  private getLatencySeconds(): number {
    const ctx = this.ctx as (AudioContext & { baseLatency?: number; outputLatency?: number }) | null;
    if (!ctx) return 0;
    return (ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0);
  }
}

/** App-wide singleton — components import this, not the class. */
export const soundManager = new SoundManager();
