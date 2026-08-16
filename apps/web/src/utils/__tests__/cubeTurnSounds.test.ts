import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preferencesStore } from "@cubeforge/state";
import { CubeTurnSounds } from "../cubeTurnSounds";

/**
 * Minimal Audio stand-in: node has no Audio/HTMLMediaElement, and the module
 * only touches the DOM lazily (pool creation), so a fake is enough to assert
 * playback wiring without a browser.
 */
class FakeAudio {
  static instances: FakeAudio[] = [];
  /** Every element that has had play() called, in order (warm-up + real turns). */
  static playLog: FakeAudio[] = [];
  src: string;
  preload = "";
  volume = 1;
  muted = false;
  paused = true;
  currentTime = 0;
  load = vi.fn();
  play = vi.fn(() => {
    this.paused = false;
    FakeAudio.playLog.push(this);
    return Promise.resolve();
  });

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
}

const random = (value: number) => () => value;

// The pool is built in source order with 2 copies per source (POOL_SIZE 8 / 4
// samples), so an instance's source is its position in `instances` divided by 2.
const COPIES_PER_SOURCE = 2;
const sourceIndexOf = (el: FakeAudio) =>
  Math.floor(FakeAudio.instances.indexOf(el) / COPIES_PER_SOURCE);

describe("CubeTurnSounds", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    FakeAudio.playLog = [];
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Restore defaults so tests never leak a muted state into each other.
    preferencesStore.getState().setNotificationsEnabled(true);
    preferencesStore.getState().setSoundsEnabled(true);
    preferencesStore.getState().setSoundVolume(80);
    preferencesStore.getState().setCubeTurnSoundsEnabled(true);
  });

  it("picks a valid source index within range", () => {
    const player = new CubeTurnSounds();
    for (const value of [0, 0.2499, 0.5, 0.9999]) {
      const idx = player.pickSourceIndex(random(value));
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });

  it("never repeats the same source back-to-back", () => {
    const player = new CubeTurnSounds();
    const first = player.pickSourceIndex(random(0)); // 0
    const second = player.pickSourceIndex(random(0)); // same roll → bumped
    const third = player.pickSourceIndex(random(0.3)); // 1 → bumped to 2
    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
  });

  it("preload decode-warms every pooled copy muted, so the first turn is instant", () => {
    const player = new CubeTurnSounds();
    player.preload();
    const pool = FakeAudio.instances;
    expect(pool).toHaveLength(8);
    // The warm-up pass played every copy once, muted, to force decode.
    expect(pool.every((a) => a.play.mock.calls.length >= 1)).toBe(true);
    expect(pool.every((a) => a.muted)).toBe(true);
  });

  it("never plays the same source twice in a row, even when every copy is busy", () => {
    const player = new CubeTurnSounds();
    player.preload();
    FakeAudio.playLog = [];
    // Every copy still playing → play() must take the busy-fallback path AND
    // still avoid the source that just played.
    FakeAudio.instances.forEach((a) => {
      a.paused = false;
    });
    for (let i = 0; i < 30; i++) player.play();
    expect(FakeAudio.playLog).toHaveLength(30);
    for (let i = 1; i < FakeAudio.playLog.length; i++) {
      expect(sourceIndexOf(FakeAudio.playLog[i])).not.toBe(
        sourceIndexOf(FakeAudio.playLog[i - 1]),
      );
    }
  });

  it("does nothing when sounds are disabled", () => {
    preferencesStore.getState().setSoundsEnabled(false);
    const player = new CubeTurnSounds();
    player.play();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("does nothing when cube turn sounds are disabled", () => {
    preferencesStore.getState().setCubeTurnSoundsEnabled(false);
    const player = new CubeTurnSounds();
    player.play();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("builds the pool on first play and starts one sample", () => {
    const player = new CubeTurnSounds();
    player.play();
    expect(FakeAudio.instances.length).toBeGreaterThan(0);
    const played = FakeAudio.instances.filter((a) => !a.paused);
    expect(played).toHaveLength(1);
  });

  it("scales playback volume from the soundVolume preference", () => {
    preferencesStore.getState().setSoundVolume(35);
    const player = new CubeTurnSounds();
    player.play();
    const played = FakeAudio.instances.find((a) => !a.paused);
    expect(played?.volume).toBeCloseTo(0.35);
  });

  it("reuses the pool instead of allocating an element per turn", () => {
    const player = new CubeTurnSounds();
    player.preload();
    const poolSize = FakeAudio.instances.length;
    expect(poolSize).toBeGreaterThan(0);
    for (let i = 0; i < 25; i++) player.play();
    expect(FakeAudio.instances).toHaveLength(poolSize);
    expect(FakeAudio.instances.every((a) => a.play.mock.calls.length >= 1)).toBe(true);
  });

  it("restarts a playing copy from the top on very fast turns", () => {
    const player = new CubeTurnSounds();
    player.play();
    // Force every pooled element to look busy → play() must still fire a
    // sample (falling back to the round-robin slot) rather than dropping.
    FakeAudio.instances.forEach((a) => {
      a.paused = false;
    });
    player.play();
    const totalPlays = FakeAudio.instances.reduce(
      (sum, a) => sum + a.play.mock.calls.length,
      0,
    );
    expect(totalPlays).toBeGreaterThanOrEqual(2);
  });
});
