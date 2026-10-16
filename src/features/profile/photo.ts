import { ValidationError } from '@/domain/validation';

/** Side of the stored square photo, in pixels: sharp at 2–3× for every avatar in the app. */
const SIDE = 320;
const MAX_FILE_BYTES = 30 * 1024 * 1024;

/**
 * Turns a picked image into a small square JPEG, entirely on the device:
 * centred horizontally and a little high on portraits, where the face
 * usually is. Nothing is uploaded anywhere.
 */
export async function photoFromFile(file: File): Promise<string> {
  if (file.type && !file.type.startsWith('image/')) throw new ValidationError('Elige un archivo de imagen (JPG, PNG o HEIC).');
  if (file.size > MAX_FILE_BYTES) throw new ValidationError('La imagen es demasiado grande. Prueba con otra de menos de 30 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new ValidationError('No se ha podido leer esta imagen. Prueba con una foto en JPG o PNG.');
    }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new ValidationError('No se ha podido leer esta imagen. Prueba con una foto en JPG o PNG.');
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = h > w ? (h - side) * 0.3 : 0;
    const out = Math.min(SIDE, side);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ValidationError('Este navegador no permite preparar la foto.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
