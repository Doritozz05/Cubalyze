import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  detectMediaType,
  MediaValidationError,
  extractVideoMetadata,
} from "../mediaUtils";

describe("detectMediaType", () => {
  it("identifies MP4 videos", () => {
    const file = new File(["dummy"], "video.mp4", { type: "video/mp4" });
    expect(detectMediaType(file)).toBe("video");
  });

  it("identifies WebM videos", () => {
    const file = new File(["dummy"], "clip.webm", { type: "video/webm" });
    expect(detectMediaType(file)).toBe("video");
  });

  it("identifies videos by extension even if mime is generic", () => {
    const file = new File(["dummy"], "loop.mov", { type: "" });
    expect(detectMediaType(file)).toBe("video");
  });

  it("identifies animated GIFs", () => {
    const file = new File(["dummy"], "animation.gif", { type: "image/gif" });
    expect(detectMediaType(file)).toBe("gif");
  });

  it("identifies standard images as image", () => {
    const fileJpg = new File(["dummy"], "photo.jpg", { type: "image/jpeg" });
    expect(detectMediaType(fileJpg)).toBe("image");

    const filePng = new File(["dummy"], "art.png", { type: "image/png" });
    expect(detectMediaType(filePng)).toBe("image");

    const fileWebp = new File(["dummy"], "scenery.webp", { type: "image/webp" });
    expect(detectMediaType(fileWebp)).toBe("image");
  });
});

interface MockVideoElement {
  preload: string;
  muted: boolean;
  playsInline: boolean;
  src: string;
  duration: number;
  videoWidth: number;
  videoHeight: number;
  currentTime: number;
  onloadedmetadata: (() => void) | null;
  onseeked?: (() => void) | null;
  onerror?: (() => void) | null;
  removeAttribute: () => void;
  load: () => void;
}

describe("extractVideoMetadata validation", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-video"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects videos exceeding the maximum duration (> 10s)", async () => {
    vi.stubGlobal("document", {
      createElement: (tagName: string) => {
        if (tagName === "video") {
          const mockVideo: MockVideoElement = {
            preload: "",
            muted: false,
            playsInline: false,
            src: "",
            duration: 12.5, // > 10.05s limit
            videoWidth: 1920,
            videoHeight: 1080,
            currentTime: 0,
            onloadedmetadata: null,
            onerror: null,
            removeAttribute: vi.fn(),
            load: vi.fn(),
          };
          setTimeout(() => {
            if (mockVideo.onloadedmetadata) mockVideo.onloadedmetadata();
          }, 5);
          return mockVideo as unknown as HTMLVideoElement;
        }
        return {} as unknown as HTMLElement;
      },
    });

    const file = new File(["dummy"], "long_video.mp4", { type: "video/mp4" });
    await expect(extractVideoMetadata(file)).rejects.toThrow(
      MediaValidationError,
    );
  });

  it("accepts videos under the maximum duration (<= 10s)", async () => {
    vi.stubGlobal("document", {
      createElement: (tagName: string) => {
        if (tagName === "video") {
          const mockVideo: MockVideoElement = {
            preload: "",
            muted: false,
            playsInline: false,
            src: "",
            duration: 5.4, // <= 10.05s
            videoWidth: 1280,
            videoHeight: 720,
            currentTime: 0,
            onloadedmetadata: null,
            onseeked: null,
            removeAttribute: vi.fn(),
            load: vi.fn(),
          };
          setTimeout(() => {
            if (mockVideo.onloadedmetadata) mockVideo.onloadedmetadata();
            setTimeout(() => {
              if (mockVideo.onseeked) mockVideo.onseeked();
            }, 5);
          }, 5);
          return mockVideo as unknown as HTMLVideoElement;
        }
        if (tagName === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              imageSmoothingEnabled: false,
              imageSmoothingQuality: "high",
              drawImage: vi.fn(),
            }),
            toDataURL: () => "data:image/jpeg;base64,mock-poster",
          } as unknown as HTMLCanvasElement;
        }
        return {} as unknown as HTMLElement;
      },
    });

    const file = new File(["dummy"], "short_video.mp4", { type: "video/mp4" });
    const meta = await extractVideoMetadata(file);
    expect(meta.duration).toBe(5.4);
    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(720);
    expect(meta.posterDataUrl).toBe("data:image/jpeg;base64,mock-poster");
  });
});
