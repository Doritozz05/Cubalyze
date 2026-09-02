/**
 * Utilities for validating, processing, and extracting posters from
 * background images, animated GIFs, and videos (<10s).
 */

export const MAX_VIDEO_DURATION_SECONDS = 10.05;
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_MEDIA_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB

export type BackgroundMediaType = "image" | "video" | "gif";

export class MediaValidationError extends Error {
  code: "DURATION_EXCEEDED" | "SIZE_EXCEEDED" | "LOAD_FAILED" | "INVALID_TYPE";
  duration?: number;

  constructor(
    message: string,
    code: "DURATION_EXCEEDED" | "SIZE_EXCEEDED" | "LOAD_FAILED" | "INVALID_TYPE",
    duration?: number,
  ) {
    super(message);
    this.name = "MediaValidationError";
    this.code = code;
    this.duration = duration;
  }
}

export interface ProcessedBackgroundMedia {
  blob: Blob;
  mimeType: string;
  mediaType: BackgroundMediaType;
  name: string;
  posterDataUrl: string;
  duration?: number;
  width?: number;
  height?: number;
}

export function detectMediaType(file: File): BackgroundMediaType {
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();

  if (mime.startsWith("video/") || /\.(mp4|webm|mov|ogg|m4v)$/i.test(name)) {
    return "video";
  }
  if (mime === "image/gif" || name.endsWith(".gif")) {
    return "gif";
  }
  return "image";
}

/**
 * Extracts metadata and a static poster frame from a video file,
 * asserting that its duration does not exceed the limit (<10s).
 */
export function extractVideoMetadata(
  file: File,
  maxDuration = MAX_VIDEO_DURATION_SECONDS,
): Promise<{ duration: number; width: number; height: number; posterDataUrl: string }> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new MediaValidationError("DOM not available", "LOAD_FAILED"));
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    let hasHandledSeek = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.onerror = () => {
      cleanup();
      reject(
        new MediaValidationError(
          "Failed to decode or load video file",
          "LOAD_FAILED",
        ),
      );
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > maxDuration) {
        cleanup();
        reject(
          new MediaValidationError(
            `Video duration of ${duration.toFixed(1)}s exceeds limit of 10s`,
            "DURATION_EXCEEDED",
            duration,
          ),
        );
        return;
      }

      // Seek to a fraction of a second to ensure a valid frame is ready to paint
      video.currentTime = Math.min(0.05, duration > 0 ? duration / 2 : 0.05);
    };

    video.onseeked = () => {
      if (hasHandledSeek) return;
      hasHandledSeek = true;

      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(width, 1920);
        canvas.height = Math.round((canvas.width / width) * height);

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const posterDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          cleanup();
          resolve({
            duration: video.duration || 0,
            width,
            height,
            posterDataUrl,
          });
          return;
        }
      } catch (err) {
        console.warn("[MediaUtils] Failed to capture video poster frame:", err);
      }

      cleanup();
      resolve({
        duration: video.duration || 0,
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720,
        posterDataUrl: "",
      });
    };
  });
}

/**
 * Extracts the first static frame from an animated GIF using an offscreen canvas.
 */
export function extractGifPoster(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new MediaValidationError("DOM not available", "LOAD_FAILED"));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width || 800;
        const height = img.naturalHeight || img.height || 600;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const poster = canvas.toDataURL("image/jpeg", 0.88);
          URL.revokeObjectURL(objectUrl);
          resolve(poster);
          return;
        }
      } catch (err) {
        console.warn("[MediaUtils] Canvas error on GIF poster extraction:", err);
      }
      URL.revokeObjectURL(objectUrl);
      resolve("");
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new MediaValidationError("Failed to load GIF image", "LOAD_FAILED"));
    };

    img.src = objectUrl;
  });
}

/**
 * Validates and extracts a static poster for an uploaded background media file
 * (image, animated GIF, or video <10s).
 */
export async function validateAndProcessBackgroundMedia(
  file: File,
): Promise<ProcessedBackgroundMedia> {
  const mediaType = detectMediaType(file);

  if (mediaType === "video") {
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      throw new MediaValidationError(
        `Video file size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 50MB limit`,
        "SIZE_EXCEEDED",
      );
    }

    const meta = await extractVideoMetadata(file);
    return {
      blob: file,
      mimeType: file.type || "video/mp4",
      mediaType: "video",
      name: file.name,
      posterDataUrl: meta.posterDataUrl,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
    };
  }

  if (mediaType === "gif") {
    if (file.size > MAX_MEDIA_SIZE_BYTES) {
      throw new MediaValidationError(
        `GIF file size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 30MB limit`,
        "SIZE_EXCEEDED",
      );
    }

    const poster = await extractGifPoster(file);
    return {
      blob: file,
      mimeType: "image/gif",
      mediaType: "gif",
      name: file.name,
      posterDataUrl: poster,
    };
  }

  // Static Image
  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    throw new MediaValidationError(
      `Image file size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 30MB limit`,
      "SIZE_EXCEEDED",
    );
  }

  // For static images, generate a poster data URL so thumbnail previews are instant
  const poster = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });

  return {
    blob: file,
    mimeType: file.type || "image/jpeg",
    mediaType: "image",
    name: file.name,
    posterDataUrl: poster,
  };
}
