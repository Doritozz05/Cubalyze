import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundManager, type AssetDescriptor } from "../soundManager";
import {
  FakeAudioContext,
  FakeOfflineAudioContext,
  flushMicrotasks,
  resetAudioFakes,
  setupAudioTestEnv,
  warmOfflineAssets,
  type AudioTestEnv,
} from "./webAudioFakes";

const ASSETS: AssetDescriptor[] = [{ id: "a", url: "/a.wav" }];

let env: AudioTestEnv;
let windowTarget: AudioTestEnv["windowTarget"];

/** Preload + fully warm the asset bank (offline decode), then fire the first
 *  user gesture so the live AudioContext exists. */
const warmPlayer = async (sound: SoundManager, assets: AssetDescriptor[] = ASSETS) => {
  const done = sound.preload(assets);
  await warmOfflineAssets(assets.length);
  await done;
  windowTarget.dispatch("pointerdown");
  await flushMicrotasks();
  return sound;
};

describe("SoundManager", () => {
  beforeEach(() => {
    resetAudioFakes();
    env = setupAudioTestEnv();
    windowTarget = env.windowTarget;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("armForUserGesture attaches the unlock hooks app-wide (no preload needed) — the first gesture anywhere creates the context", async () => {
    const sound = new SoundManager();
    // App startup: NO preload, NO fetch, NO context yet — only hooks armed.
    sound.armForUserGesture();
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(env.fetchMock).not.toHaveBeenCalled();
    // The first trusted gesture ANYWHERE (e.g. a nav click on the timer page)
    // creates the shared context and starts the device open early — this is
    // what makes the later first cube turn play instantly instead of paying
    // the ~1 s cold-start on the move itself.
    windowTarget.dispatch("pointerdown");
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].state).toBe("running");
    // The one-time unlock hooks self-remove after the first gesture.
    expect(windowTarget.count("pointerdown")).toBe(0);
  });

  it("warmOnLoad pre-creates the context in idle time (no gesture, no resume) and the first gesture then plays", async () => {
    // Idle-time creation: run the requestIdleCallback immediately.
    vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
      cb();
      return 1;
    });
    const sound = new SoundManager();
    sound.warmOnLoad();
    // Autoplay-safe: the context exists with NO gesture and NO resume call.
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].resume).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances[0].state).toBe("suspended");
    // Warm the bank, then the first gesture resumes and a turn plays — the
    // device was pre-opened, so this is the fast path (no cold construction).
    const done = sound.preload(ASSETS);
    await warmOfflineAssets(1);
    await done;
    windowTarget.dispatch("pointerdown");
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalled();
    sound.play("a");
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it("warmOnLoad also creates the context on the FIRST user signal when the idle callback never fires (hard-reload race)", () => {
    // requestIdleCallback exists but NEVER fires (busy load / hidden tab) —
    // the exact hard-reload failure mode measured in the browser.
    vi.stubGlobal("requestIdleCallback", () => 1);
    const sound = new SoundManager();
    sound.warmOnLoad();
    expect(FakeAudioContext.instances).toHaveLength(0);
    // The user's first mouse movement (before any drag/key) creates the
    // context — cold construction happens during the approach, not the move.
    windowTarget.dispatch("pointermove");
    expect(FakeAudioContext.instances).toHaveLength(1);
    // No resume was attempted (creation needs no gesture; only playback
    // does — and the fake had no activation anyway).
    expect(FakeAudioContext.instances[0].resume).not.toHaveBeenCalled();
  });

  it("signal warm-up is one-time — later signals never recreate the context", () => {
    vi.stubGlobal("requestIdleCallback", () => 1);
    const sound = new SoundManager();
    sound.warmOnLoad();
    windowTarget.dispatch("pointermove");
    windowTarget.dispatch("mousemove");
    windowTarget.dispatch("keydown");
    windowTarget.dispatch("pointermove");
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("warmOnLoad falls back to setTimeout when requestIdleCallback is unavailable", async () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    const sound = new SoundManager();
    sound.warmOnLoad();
    // No requestIdleCallback in this environment → deferred creation via
    // setTimeout(1000). The context must NOT exist synchronously.
    expect(FakeAudioContext.instances).toHaveLength(0);
    // Fast-forward past the deferral.
    await vi.waitFor(() => expect(FakeAudioContext.instances).toHaveLength(1), { timeout: 3000 });
    expect(FakeAudioContext.instances[0].resume).not.toHaveBeenCalled();
  });

  it("decodes the asset bank through OfflineAudioContext BEFORE any user gesture (no live context)", async () => {
    const sound = new SoundManager();
    const done = sound.preload(ASSETS);
    await warmOfflineAssets(1);
    await done;
    // Autoplay policy: preload never touches the live context — the decoded
    // buffers come from the offline context, which needs no gesture.
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(FakeOfflineAudioContext.instances).toHaveLength(1);
    expect(FakeOfflineAudioContext.decodedBuffers).toHaveLength(1);
  });

  it("REGRESSION: the FIRST play after preload + gesture fires the source immediately (first-move exactness)", async () => {
    const sound = new SoundManager();
    await warmPlayer(sound);
    sound.play("a");
    // No waitFor needed: the very first cue must start a one-shot node
    // synchronously — the old implementation queued it behind a decode that
    // only started on the first gesture (the "primer move no es exacto" bug).
    expect(FakeAudioContext.sources).toHaveLength(1);
    expect(FakeAudioContext.sources[0].start).toHaveBeenCalled();
  });

  it("warm path fires directly — a later clock freeze does not delay new plays", async () => {
    const sound = new SoundManager();
    await warmPlayer(sound);
    // First play drains the gate synchronously (fake clock advances), which
    // marks the clock as settled.
    sound.play("a");
    expect(FakeAudioContext.sources).toHaveLength(1);
    // Freeze the clock: the warm path must NOT go through the gate — if it
    // did, the cue would wait for a tick and nothing would play.
    FakeAudioContext.instances[0].clockFrozen = true;
    sound.play("a");
    expect(FakeAudioContext.sources).toHaveLength(2);
  });

  it("cold path gates on the frozen clock (device reopening) and fires at the first tick", async () => {
    const sound = new SoundManager();
    await warmPlayer(sound);
    const ctx = FakeAudioContext.instances[0];
    // Freeze synchronously before the eager clock observer can settle.
    ctx.clockFrozen = true;
    sound.play("a");
    expect(FakeAudioContext.sources).toHaveLength(0);
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(0);
    // The device finishes reopening → the clock ticks → the cue plays NOW.
    ctx.tick(0.1);
    await vi.waitFor(() => expect(FakeAudioContext.sources).toHaveLength(1));
    expect(FakeAudioContext.sources[0].start).toHaveBeenCalled();
  });

  it("queues cues that land while preload is still in flight and plays them once decoded", async () => {
    const sound = new SoundManager();
    windowTarget.dispatch("pointerdown");
    await flushMicrotasks();
    const done = sound.preload(ASSETS); // fetch/decode in flight
    sound.play("a");
    sound.play("a");
    expect(FakeAudioContext.sources).toHaveLength(0);
    await warmOfflineAssets(1);
    await done;
    await vi.waitFor(() => expect(FakeAudioContext.sources).toHaveLength(2));
  });

  it("applies pitch jitter within the requested bounds (anti-repetition fatigue)", async () => {
    const sound = new SoundManager();
    await warmPlayer(sound);
    for (let i = 0; i < 60; i++) sound.play("a", { jitter: { pitch: 0.04 } });
    expect(FakeAudioContext.sources).toHaveLength(60);
    const rates = FakeAudioContext.sources.map((s) => s.playbackRate.value);
    for (const rate of rates) {
      expect(rate).toBeGreaterThanOrEqual(0.96);
      expect(rate).toBeLessThanOrEqual(1.04);
    }
    // The jitter actually varies (not every play is identical).
    expect(new Set(rates).size).toBeGreaterThan(1);
  });

  it("scales master volume (0-100) onto the master bus and keeps per-voice volume jittered", async () => {
    const sound = new SoundManager();
    sound.setMasterVolume(35);
    await warmPlayer(sound);
    // ensureGraph created master (0), sfx (1), ui (2); master reflects the pref.
    expect(FakeAudioContext.gains[0]!.gain.value).toBeCloseTo(0.35);
    sound.play("a", { volume: 1, jitter: { volume: 0.05 } });
    const voiceGain = FakeAudioContext.gains[3];
    expect(voiceGain.gain.value).toBeGreaterThanOrEqual(0.95);
    expect(voiceGain.gain.value).toBeLessThanOrEqual(1.05);
  });

  it("builds the mixer graph: master → compressor → destination, buses → master", async () => {
    const sound = new SoundManager();
    await warmPlayer(sound);
    expect(FakeAudioContext.compressors).toHaveLength(1);
    const compressor = FakeAudioContext.compressors[0];
    const master = FakeAudioContext.gains[0];
    const sfx = FakeAudioContext.gains[1];
    const ui = FakeAudioContext.gains[2];
    expect(master.connect).toHaveBeenCalledWith(compressor);
    expect(compressor.connect).toHaveBeenCalledWith(FakeAudioContext.instances[0].destination);
    expect(sfx.connect).toHaveBeenCalledWith(master);
    expect(ui.connect).toHaveBeenCalledWith(master);
  });

  it("applies click-free envelopes (attack ramp in, release ramp on stop)", async () => {
    const sound = new SoundManager();
    await warmPlayer(sound);
    sound.play("a", { releaseMs: 20 });
    const voiceGain = FakeAudioContext.gains[3];
    // Attack: ramps from near-silence to the voice volume.
    expect(voiceGain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, expect.any(Number));
    expect(voiceGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
    );
    // Release (first voice id = 1): ramp down to silence, then stop.
    sound.stop(1);
    expect(FakeAudioContext.sources[0].stop).toHaveBeenCalled();
    expect(voiceGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.0001, expect.any(Number));
  });

  it("steals the oldest lowest-priority voice when the voice cap is exceeded", async () => {
    const sound = new SoundManager(2);
    await warmPlayer(sound);
    sound.play("a", { priority: 0 });
    sound.play("a", { priority: 0 });
    sound.play("a", { priority: 0 }); // cap reached → oldest (first) is stolen
    expect(FakeAudioContext.sources).toHaveLength(3);
    expect(FakeAudioContext.sources[0].stop).toHaveBeenCalled();
    expect(FakeAudioContext.sources[1].stop).not.toHaveBeenCalled();
    expect(FakeAudioContext.sources[2].stop).not.toHaveBeenCalled();
  });

  it("drops a newcomer whose priority is lower than every active voice", async () => {
    const sound = new SoundManager(2);
    await warmPlayer(sound);
    sound.play("a", { priority: 5 });
    sound.play("a", { priority: 5 });
    sound.play("a", { priority: 1 }); // lowest priority → dropped, no steal
    expect(FakeAudioContext.sources).toHaveLength(2);
    for (const source of FakeAudioContext.sources) {
      expect(source.stop).not.toHaveBeenCalled();
    }
  });

  it("drops cues for an asset whose fetch failed (stays silent, never hangs)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const sound = new SoundManager();
    const done = sound.preload(ASSETS);
    await done;
    windowTarget.dispatch("pointerdown");
    await flushMicrotasks();
    sound.play("a");
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(0);
  });

  it("routes the fanfare through the ui bus, ducks the sfx bus and respects master volume", async () => {
    const sound = new SoundManager();
    sound.setMasterVolume(35);
    windowTarget.dispatch("pointerdown");
    await flushMicrotasks();
    sound.playFanfare([659.25]);
    expect(FakeAudioContext.oscillators).toHaveLength(1);
    // Fanfare voice gain (created after master/sfx/ui → index 3) connects to
    // the ui bus (index 2).
    const fanfareGain = FakeAudioContext.gains[3];
    expect(fanfareGain.connect).toHaveBeenCalledWith(FakeAudioContext.gains[2]);
    // SFX bus ducked so the chime cuts through.
    const sfx = FakeAudioContext.gains[1];
    expect(sfx.gain.setTargetAtTime).toHaveBeenCalledWith(0.35, expect.any(Number), 0.02);
    // Master volume (preference) scales the whole graph.
    expect(FakeAudioContext.gains[0]!.gain.value).toBeCloseTo(0.35);
  });

  it("routes a panned voice through a StereoPannerNode", async () => {
    const sound = new SoundManager();
    await warmPlayer(sound);
    sound.play("a", { pan: 0.5 });
    expect(FakeAudioContext.panNodes).toHaveLength(1);
    expect(FakeAudioContext.panNodes[0].pan.value).toBe(0.5);
  });

  it("reports end-to-end latency from baseLatency + outputLatency", async () => {
    const sound = new SoundManager();
    await warmPlayer(sound);
    const ctx = FakeAudioContext.instances[0] as unknown as {
      baseLatency: number;
      outputLatency: number;
    };
    ctx.baseLatency = 0.05;
    ctx.outputLatency = 0.1;
    expect(sound.getLatencyMs()).toBe(150);
  });
});
