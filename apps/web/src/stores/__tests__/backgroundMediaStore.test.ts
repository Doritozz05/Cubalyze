import { describe, it, expect, beforeEach } from "vitest";
import { useBackgroundMediaStore } from "../backgroundMediaStore";
import { preferencesStore } from "@cubeforge/state";

describe("useBackgroundMediaStore", () => {
  beforeEach(() => {
    useBackgroundMediaStore.setState({
      mediaUrl: null,
      posterUrl: null,
      mediaType: null,
      duration: null,
      fileName: null,
      isLoading: false,
      isAnimating: false,
      animationKey: 0,
    });
    preferencesStore.getState().setTimerBackgroundImage(null);
  });

  it("toggles isAnimating and increments animationKey on start", () => {
    const store = useBackgroundMediaStore.getState();
    expect(store.isAnimating).toBe(false);
    expect(store.animationKey).toBe(0);

    // Inspection starts
    useBackgroundMediaStore.getState().setIsAnimating(true);
    expect(useBackgroundMediaStore.getState().isAnimating).toBe(true);
    expect(useBackgroundMediaStore.getState().animationKey).toBe(1);

    // Redundant true call does not increment key again
    useBackgroundMediaStore.getState().setIsAnimating(true);
    expect(useBackgroundMediaStore.getState().animationKey).toBe(1);

    // Solve finishes
    useBackgroundMediaStore.getState().setIsAnimating(false);
    expect(useBackgroundMediaStore.getState().isAnimating).toBe(false);
    expect(useBackgroundMediaStore.getState().animationKey).toBe(1);

    // Next solve inspection starts
    useBackgroundMediaStore.getState().setIsAnimating(true);
    expect(useBackgroundMediaStore.getState().isAnimating).toBe(true);
    expect(useBackgroundMediaStore.getState().animationKey).toBe(2);
  });

  it("loads legacy data URL as an image background", async () => {
    const legacyDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    preferencesStore.getState().setTimerBackgroundImage(legacyDataUrl);

    await useBackgroundMediaStore.getState().loadMedia();

    const state = useBackgroundMediaStore.getState();
    expect(state.mediaUrl).toBe(legacyDataUrl);
    expect(state.mediaType).toBe("image");
    expect(state.posterUrl).toBe(legacyDataUrl);
  });

  it("defaults timerBackgroundAllViews to false and allows toggling", () => {
    expect(preferencesStore.getState().timerBackgroundAllViews).toBe(false);

    preferencesStore.getState().setTimerBackgroundAllViews(true);
    expect(preferencesStore.getState().timerBackgroundAllViews).toBe(true);

    preferencesStore.getState().setTimerBackgroundAllViews(false);
    expect(preferencesStore.getState().timerBackgroundAllViews).toBe(false);
  });
});
