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
  src: string;
  preload = "";
  volume = 1;
  paused = true;
  currentTime = 0;
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
}

const random = (value: number) => () => value;

describe("CubeTurnSounds", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
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
