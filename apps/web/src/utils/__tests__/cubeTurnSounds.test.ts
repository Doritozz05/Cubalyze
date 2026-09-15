import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preferencesStore } from "@cubalyze/state";
import { SoundManager } from "@/audio/soundManager";
import { CubeTurnSounds } from "../cubeTurnSounds";
import {
  FakeAudioBuffer,
  FakeAudioContext,
  FakeOfflineAudioContext,
  flushMicrotasks,
  resetAudioFakes,
  setupAudioTestEnv,
  warmOfflineAssets,
  type AudioTestEnv,
} from "@/audio/__tests__/webAudioFakes";

/**
 * Suite for the CubeTurnSounds facade. Every case builds a fresh facade over
 * a fresh SoundManager so the shared singleton never leaks state between
 * tests. The Web Audio graph is faked (see webAudioFakes.ts): samples are
 * decoded through the OFFLINE context during preload (no gesture), and the
 * live context is created on the first user gesture.
 */

const makePlayer = (): CubeTurnSounds => new CubeTurnSounds(new SoundManager());

const random = (value: number) => () => value;

let env: AudioTestEnv;
let windowTarget: AudioTestEnv["windowTarget"];
let documentTarget: AudioTestEnv["documentTarget"];
let fetchMock: AudioTestEnv["fetchMock"];

/**
 * Standard warm setup: preload (fetches + offline-decodes all 4 samples),
 * then fire the FIRST user gesture, which creates the live AudioContext.
 */
const initWarmPlayer = async (player: CubeTurnSounds = makePlayer()) => {
  player.preload();
  await warmOfflineAssets(4);
  windowTarget.dispatch("pointerdown");
  await flushMicrotasks();
  return player;
};

describe("CubeTurnSounds", () => {
  beforeEach(() => {
    resetAudioFakes();
    env = setupAudioTestEnv();
    windowTarget = env.windowTarget;
    documentTarget = env.documentTarget;
    fetchMock = env.fetchMock;
    // Enable cube turn sounds during test runs that test the player
    preferencesStore.getState().setCubeTurnSoundsEnabled(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Restore defaults so tests never leak prefs into each other.
    preferencesStore.getState().setNotificationsEnabled(true);
    preferencesStore.getState().setSoundsEnabled(true);
    preferencesStore.getState().setSoundVolume(80);
    preferencesStore.getState().setCubeTurnSoundsEnabled(false);
  });

  it("picks a valid source index within range", () => {
    const player = makePlayer();
    for (const value of [0, 0.2499, 0.5, 0.9999]) {
      const idx = player.pickSourceIndex(random(value));
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });

  it("never repeats the same source back-to-back", () => {
    const player = makePlayer();
    const first = player.pickSourceIndex(random(0)); // 0
    const second = player.pickSourceIndex(random(0)); // same roll → bumped
    const third = player.pickSourceIndex(random(0.3)); // 1 → bumped to 2
    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
  });

  it("preload decodes the bank offline BEFORE a gesture, and the first turn fires instantly", async () => {
    const player = makePlayer();
    player.preload();
    await warmOfflineAssets(4);
    // Autoplay policy: no live context on mount — only the offline bank
    // warmed (this is the fix for the first-move latency).
    expect(FakeAudioContext.instances).toHaveLength(0);
    // First gesture creates the live context…
    windowTarget.dispatch("pointerdown");
    await flushMicrotasks();
    expect(FakeAudioContext.instances).toHaveLength(1);
    // …and the very first turn fires a one-shot source IMMEDIATELY — the
    // buffers are already decoded, so the click lands on the move itself.
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(1);
    expect(FakeAudioContext.sources[0].buffer).toBeInstanceOf(FakeAudioBuffer);
    expect(FakeAudioContext.sources[0].start).toHaveBeenCalled();
  });

  it("never plays the same source twice in a row, even on rapid turns", async () => {
    const player = await initWarmPlayer();
    for (let i = 0; i < 30; i++) player.play();
    expect(FakeAudioContext.sources).toHaveLength(30);
    const bufferIndexOf = (b: FakeAudioBuffer | null) =>
      b === null ? -1 : FakeOfflineAudioContext.decodedBuffers.indexOf(b);
    for (let i = 1; i < FakeAudioContext.sources.length; i++) {
      expect(bufferIndexOf(FakeAudioContext.sources[i].buffer)).not.toBe(
        bufferIndexOf(FakeAudioContext.sources[i - 1].buffer),
      );
    }
  });

  it("does nothing when sounds are disabled", () => {
    preferencesStore.getState().setSoundsEnabled(false);
    const player = makePlayer();
    player.play();
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when cube turn sounds are disabled", () => {
    preferencesStore.getState().setCubeTurnSoundsEnabled(false);
    const player = makePlayer();
    player.play();
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queues turns that land before the first decode and plays them once ready", async () => {
    const player = makePlayer();
    // No preload yet: the first play kicks the bank warm-up itself.
    player.play();
    player.play();
    // Decode still in flight → nothing audible yet, both cues queued.
    expect(FakeAudioContext.sources).toHaveLength(0);
    await warmOfflineAssets(4);
    await vi.waitFor(() => expect(FakeAudioContext.sources).toHaveLength(2));
    expect(FakeAudioContext.sources[0].buffer).toBeInstanceOf(FakeAudioBuffer);
    expect(FakeAudioContext.sources[1].buffer).toBeInstanceOf(FakeAudioBuffer);
  });

  it("scales playback volume from the soundVolume preference (master bus)", async () => {
    preferencesStore.getState().setSoundVolume(35);
    const player = await initWarmPlayer();
    player.play();
    // Master bus gain (created first in the mixer graph) follows the pref.
    expect(FakeAudioContext.gains[0]!.gain.value).toBeCloseTo(0.35);
  });

  it("resumes a suspended AudioContext when returning to the tab", async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // Simulate the background-tab freeze Chrome applies while the tab is hidden.
    ctx.setState("suspended");
    player.play();
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe("running");
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it("eagerly resumes the context when the tab becomes visible again, before the user acts", async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    // Chrome suspended the context while the tab was hidden…
    ctx.setState("suspended");
    // …and the user returns: visibilitychange fires BEFORE any new gesture,
    // so the device reopen starts before they turn the cube.
    documentTarget.hidden = false;
    documentTarget.dispatch("visibilitychange");
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(ctx.state).toBe("running");
    // A turn now is deterministic: no resume round-trip, instant source.
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it("does not resume while the tab is still hidden", async () => {
    await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    ctx.setState("suspended");
    documentTarget.hidden = true;
    documentTarget.dispatch("visibilitychange");
    // No NEW resume from the hidden-tab hook (the setup unlock is the only one).
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe("suspended");
  });

  it("resumes the context when the window regains focus", async () => {
    await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe("running");
    // Leaves the tab → Chrome suspends the context.
    ctx.setState("suspended");
    // Window regains focus → eager resume (context already unlocked).
    windowTarget.dispatch("focus");
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(ctx.state).toBe("running");
    // A second focus while running is a cheap no-op — no extra resume.
    windowTarget.dispatch("focus");
    expect(ctx.resume).toHaveBeenCalledTimes(2);
  });

  it("starts the device reopen on the first pointermove after returning (before the turn)", async () => {
    await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe("running");
    // Leaves the tab → Chrome suspends the context.
    ctx.setState("suspended");
    // User returns and moves the mouse toward the cube — this fires before
    // the actual layer drag, so the device reopen overlaps with the approach.
    windowTarget.dispatch("pointermove");
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(ctx.state).toBe("running");
    // While running, pointer moves must not hammer resume() — guarded no-op.
    windowTarget.dispatch("pointermove");
    windowTarget.dispatch("mousemove");
    expect(ctx.resume).toHaveBeenCalledTimes(2);
  });

  it("does not create a context or resume from non-gesture hooks before the first user gesture (autoplay)", async () => {
    const player = makePlayer();
    player.preload();
    await warmOfflineAssets(4);
    // Fresh load: the offline bank is warm but there is NO live context yet.
    expect(FakeAudioContext.instances).toHaveLength(0);
    // The non-gesture hooks fire (visibilitychange on load, window focus,
    // mouse movement) but have nothing to resume — and they never create the
    // context either, so Chrome cannot log "The AudioContext was not allowed
    // to start" before the user interacts.
    documentTarget.dispatch("visibilitychange");
    windowTarget.dispatch("focus");
    windowTarget.dispatch("pointermove");
    windowTarget.dispatch("mousemove");
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("does not stack redundant resume() calls while one is in flight", async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // The user left the tab (context suspended).
    ctx.setState("suspended");
    // The next device reopen is slow: the resume stays pending…
    let finishResume!: () => void;
    ctx.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishResume = () => {
            ctx.setState("running");
            resolve();
          };
        }),
    );
    // …while several hooks and turns fire. Only ONE resume() may start.
    windowTarget.dispatch("visibilitychange");
    player.play();
    player.play();
    expect(ctx.resume).toHaveBeenCalledTimes(2); // unlock + the in-flight one
    expect(FakeAudioContext.sources).toHaveLength(0);
    // The reopen completes → the queued cues play.
    finishResume();
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(2);
  });

  it("treats the interrupted state like suspended (iOS Safari backgrounding)", async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // iOS Safari moves the context to 'interrupted' when the user leaves the
    // page (tab switch / screen lock) — MDN documents resume() as the fix.
    ctx.setState("interrupted");
    player.play();
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe("running");
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it("never starts a source on a frozen clock — the cue plays when the context runs", async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // A suspended context whose resume completes LATER (real browsers resolve
    // the promise asynchronously). The turn must not fire into silence.
    ctx.setState("suspended");
    let finishResume!: () => void;
    ctx.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishResume = () => {
            ctx.setState("running");
            resolve();
          };
        }),
    );
    player.play();
    // Clock still frozen → the cue is queued, nothing audible yet.
    expect(FakeAudioContext.sources).toHaveLength(0);
    finishResume();
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
    expect(FakeAudioContext.sources[0].start).toHaveBeenCalled();
  });

  it("does not fire a source on a running context whose clock is still frozen (device reopening)", async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    // Chromium flips the context back to 'running' while the audio device is
    // still reopening after the tab was hidden — currentTime stays frozen for
    // up to ~1 s (crbug.com/41302928). Firing into that frozen clock is the
    // "sound comes out a while later" bug, so nothing may play yet.
    ctx.clockFrozen = true;
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(0);
    // Let resume() settle: the clock-gate is now polling the frozen clock.
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(0);
    // The device finishes reopening → the clock ticks → the cue plays NOW.
    ctx.tick(0.1);
    await vi.waitFor(() => expect(FakeAudioContext.sources).toHaveLength(1));
    expect(FakeAudioContext.sources[0].start).toHaveBeenCalled();
  });

  it("plays immediately when the audio clock is warm (no added latency)", async () => {
    const player = await initWarmPlayer();
    // Warm device (default fake): currentTime advances on every read, so the
    // clock gate passes on the very first check — the turn is instant.
    expect(FakeAudioContext.instances[0].clockFrozen).toBe(false);
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it("a stale clock-wait poll never double-plays a newer cue", async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    ctx.clockFrozen = true;
    player.play(); // cue A queued; its clock-wait poll starts (baseline frozen)
    await flushMicrotasks(); // resume settles → poll A is now waiting
    ctx.tick(0.1); // device reopens → currentTime 0.1
    player.play(); // cue B queued; a newer drain supersedes poll A (baseline 0.1)
    await flushMicrotasks();
    ctx.tick(0.1); // currentTime 0.2 → past both baselines
    await vi.waitFor(() => expect(FakeAudioContext.sources).toHaveLength(2));
    // Exactly two — the stale poll A must not flush anything on its own.
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(2);
  });

  it("keeps a cue queued when resume rejects (no user activation) and plays it on the next gesture", async () => {
    const player = makePlayer();
    player.preload();
    await warmOfflineAssets(4);
    // The first turn creates the context (in a real browser a turn IS a
    // gesture; the fake has no autoplay gate).
    player.play();
    const ctx = FakeAudioContext.instances[0];
    // The offline-decoded bank is ready → cue A plays (resume #1).
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
    // The tab was hidden with no user activation → Chrome rejects the next
    // resume (NotAllowedError) — the old code dropped the click.
    ctx.setState("suspended");
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    ctx.resume.mockRejectedValueOnce(new DOMException("", "NotAllowedError"));
    player.play();
    await flushMicrotasks();
    // Cue B stays queued — only cue A has played, nothing was dropped.
    expect(FakeAudioContext.sources).toHaveLength(1);
    // The next real gesture unlocks the autoplay-suspended context…
    windowTarget.dispatch("pointerdown");
    expect(ctx.state).toBe("running");
    await flushMicrotasks();
    // …and the queued turn finally plays — nothing was lost.
    expect(FakeAudioContext.sources).toHaveLength(2);
  });

  it("drains queued cues when the browser itself brings the context back to running", async () => {
    const player = await initWarmPlayer();
    const ctx = FakeAudioContext.instances[0];
    ctx.setState("suspended");
    ctx.resume.mockRejectedValue(new DOMException("", "NotAllowedError"));
    player.play();
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(0);
    // Chrome auto-resumes the context when the tab becomes visible again —
    // the statechange handler drains the cue without any further play().
    ctx.setState("running");
    await flushMicrotasks();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });

  it("creates the context on the first user gesture and self-removes the unlock hooks", async () => {
    const player = makePlayer();
    player.preload();
    await warmOfflineAssets(4);
    // Autoplay policy: NOTHING before the first gesture (not even a context).
    expect(FakeAudioContext.instances).toHaveLength(0);
    windowTarget.dispatch("pointerdown");
    expect(FakeAudioContext.instances).toHaveLength(1);
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe("running");
    // The one-time unlock listeners are removed after the first gesture.
    for (const type of ["pointerdown", "mousedown", "touchstart", "keydown", "click"]) {
      expect(windowTarget.count(type)).toBe(0);
    }
  });

  it("reuses the decoded buffers instead of refetching on every turn", async () => {
    const player = await initWarmPlayer();
    for (let i = 0; i < 25; i++) player.play();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // Every turn is a fresh one-shot node — fast turns overlap naturally.
    expect(FakeAudioContext.sources).toHaveLength(25);
  });

  it("plays turn sounds with no background audio loop", async () => {
    // Regression: the old warm-keep loop played a real (low-volume) sample
    // on repeat to keep the OS audio device open — users reported audible
    // background sound at all times. It must be gone: playback is purely
    // per-turn Web Audio, nothing loops between turns.
    const player = await initWarmPlayer();
    player.play();
    expect(FakeAudioContext.sources).toHaveLength(1);
  });
});
