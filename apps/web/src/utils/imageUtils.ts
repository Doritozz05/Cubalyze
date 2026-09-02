/**
 * Processes an uploaded image file for use as a high-quality background.
 *
 * For files under ~3.5MB, preserves the original file data URL directly without
 * any canvas re-compression, guaranteeing 100% original pixel-perfect quality.
 * For larger files, downscales using high-quality canvas smoothing to prevent
 * localStorage quota exhaustion.
 */
export { validateAndProcessBackgroundMedia } from './mediaUtils';

export function processBackgroundImage(
  file: File,
  maxSizeForOriginalBytes = 3.5 * 1024 * 1024,
  maxWidth = 2560,
  maxHeight = 1440,
  quality = 0.94
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        reject(new Error('Empty image result'));
        return;
      }

      // If the file is small enough to fit comfortably in localStorage, return the original
      // uncompressed data URL directly so there is zero loss of sharpness or color fidelity.
      if (file.size <= maxSizeForOriginalBytes) {
        resolve(result);
        return;
      }

      // For larger images (> 3.5MB), scale down with canvas to avoid storage quota errors
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          try {
            const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/webp', quality);
            resolve(dataUrl);
          } catch {
            resolve(result);
          }
        } else {
          resolve(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}
