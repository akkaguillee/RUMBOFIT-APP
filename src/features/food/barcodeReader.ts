import { isValidGtin } from '@/domain/nutrition/barcode';
import { decodeImage } from '@/domain/nutrition/ean';

/**
 * Reads product barcodes on the device: with the browser's own detector when
 * it has one (Chrome, Android) and with RUMBO's EAN reader otherwise (Safari).
 * Images never leave the phone for this; only the number is looked up.
 */

interface DetectedBarcode {
  rawValue: string;
}
interface NativeDetector {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface NativeDetectorClass {
  new (options?: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

let nativeDetector: Promise<NativeDetector | null> | null = null;

function getNativeDetector(): Promise<NativeDetector | null> {
  nativeDetector ??= (async () => {
    const Detector = (window as unknown as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
    if (!Detector) return null;
    try {
      const supported = (await Detector.getSupportedFormats?.()) ?? [];
      const formats = ['ean_13', 'ean_8', 'upc_a'].filter((f) => supported.includes(f));
      return formats.length ? new Detector({ formats }) : null;
    } catch {
      return null;
    }
  })();
  return nativeDetector;
}

/** UPC-A numbers become 13-digit EANs; anything with a wrong check digit is dropped. */
function asGtin(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const code = digits.length === 12 ? `0${digits}` : digits;
  return isValidGtin(code) ? code : null;
}

async function readNative(source: CanvasImageSource): Promise<string | null> {
  const detector = await getNativeDetector();
  if (!detector) return null;
  try {
    for (const found of await detector.detect(source)) {
      const code = asGtin(found.rawValue);
      if (code) return code;
    }
  } catch {
    // Unsupported source or platform: RUMBO's reader takes over.
  }
  return null;
}

export class BarcodeReader {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d', { willReadFrequently: true });

  private pixels(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, maxWidth: number) {
    if (!this.ctx) return null;
    const scale = Math.min(1, maxWidth / sw);
    this.canvas.width = Math.max(1, Math.round(sw * scale));
    this.canvas.height = Math.max(1, Math.round(sh * scale));
    this.ctx.drawImage(source, sx, sy, sw, sh, 0, 0, this.canvas.width, this.canvas.height);
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Looks for a code across the middle band of the live camera frame. */
  async readVideo(video: HTMLVideoElement): Promise<string | null> {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    // Some browsers expose a detector that never finds anything: fall back to our reader then too.
    const native = await readNative(video);
    if (native) return native;
    const band = h * 0.4;
    const img = this.pixels(video, w * 0.04, (h - band) / 2, w * 0.92, band, 960);
    return img ? decodeImage(img.data, img.width, img.height, { rows: 14, agree: 2 }) : null;
  }

  /** Looks for a code anywhere in a photo, horizontal or vertical. */
  async readImage(file: Blob): Promise<string | null> {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const native = await readNative(image);
      if (native) return native;
      const img = this.pixels(image, 0, 0, image.naturalWidth, image.naturalHeight, 1280);
      if (!img) return null;
      return decodeImage(img.data, img.width, img.height, { rows: 48, agree: 2 }) ?? decodeImage(img.data, img.width, img.height, { rows: 48, agree: 2, vertical: true });
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
