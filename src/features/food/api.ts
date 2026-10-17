import { parseFoodReference, parsePhotoAnalysis, type FoodReference, type PhotoAnalysis } from '@/domain/nutrition/analysis';
import { isValidGtin } from '@/domain/nutrition/barcode';
import { isPlausiblePer100 } from '@/domain/nutrition/nutrients';
import { parseOffProduct, type OffProduct } from '@/domain/nutrition/off';
import type { UsdaFood } from '@/domain/nutrition/usda';
import type { Nutrients } from '@/domain/types';

/**
 * The scanner's calls to the RUMBO server functions. Photos are resized on
 * the device and sent only for the analysis; nothing is kept on the server.
 * Every answer is validated again here before the app uses it.
 */

export type FoodErrorCode =
  | 'offline'
  | 'unavailable'
  | 'not_configured'
  | 'rate_limited'
  | 'timeout'
  | 'refused'
  | 'not_found'
  | 'bad_request'
  | 'upstream'
  | 'aborted';

export class FoodApiError extends Error {
  constructor(
    readonly code: FoodErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const BASE = '/.netlify/functions';
/** The single-file build runs from disk, without the server functions. */
const STANDALONE = import.meta.env.MODE === 'standalone';

const MESSAGES: Record<FoodErrorCode, string> = {
  offline: 'Sin conexión. El análisis necesita internet; puedes añadir el alimento a mano.',
  unavailable: 'El servicio de análisis no está disponible en esta versión de RUMBO.',
  not_configured: 'El análisis aún no está configurado en el servidor de RUMBO.',
  rate_limited: 'Demasiados análisis seguidos. Espera un minuto y vuelve a probar.',
  timeout: 'El análisis está tardando demasiado. Inténtalo de nuevo.',
  refused: 'No se ha podido analizar esta foto. Prueba con otra imagen del plato.',
  not_found: 'No hemos encontrado ese alimento.',
  bad_request: 'La solicitud no es válida.',
  upstream: 'Algo no ha ido bien en el análisis. Inténtalo de nuevo.',
  aborted: 'Análisis cancelado.',
};

const KNOWN = new Set(Object.keys(MESSAGES));

function errorFrom(status: number, body: unknown): FoodApiError {
  const err = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  const code = typeof err?.code === 'string' && KNOWN.has(err.code) ? (err.code as FoodErrorCode) : null;
  if (code) return new FoodApiError(code, typeof err?.message === 'string' && err.message ? err.message : MESSAGES[code]);
  if (status === 404 || status === 405) return new FoodApiError('unavailable', MESSAGES.unavailable);
  if (status === 429) return new FoodApiError('rate_limited', MESSAGES.rate_limited);
  if (status === 504) return new FoodApiError('timeout', MESSAGES.timeout);
  return new FoodApiError('upstream', MESSAGES.upstream);
}

function ensureOnline(): void {
  if (STANDALONE) throw new FoodApiError('unavailable', 'El escáner necesita la versión publicada de RUMBO: no funciona en el archivo HTML sin conexión.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new FoodApiError('offline', MESSAGES.offline);
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  ensureOnline();
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, { ...init, signal: ctrl.signal, headers: { accept: 'application/json', ...init.headers } });
  } catch {
    throw ctrl.signal.aborted ? new FoodApiError('timeout', MESSAGES.timeout) : new FoodApiError(navigator.onLine === false ? 'offline' : 'unavailable', MESSAGES.offline);
  } finally {
    window.clearTimeout(timer);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || (body as { ok?: unknown } | null)?.ok !== true) throw errorFrom(res.status, body);
  return body as T;
}

// ── Images ─────────────────────────────────────────────────────────────

export interface PreparedImage {
  /** JPEG ready to send, without the data URL prefix. */
  base64: string;
  /** Local preview (revoke when done). */
  url: string;
  bytes: number;
}

const MAX_EDGE = 1280;

function toJpeg(source: CanvasImageSource, w: number, h: number): PreparedImage {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new FoodApiError('bad_request', 'Este navegador no puede preparar la foto.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { base64, url: dataUrl, bytes: Math.round((base64.length * 3) / 4) };
}

/** A photo picked from the gallery, resized and re-encoded on the device (orientation applied). */
export async function prepareFile(file: Blob): Promise<PreparedImage> {
  if (file.type && !file.type.startsWith('image/')) throw new FoodApiError('bad_request', 'Elige un archivo de imagen.');
  if (file.size > 40 * 1024 * 1024) throw new FoodApiError('bad_request', 'La imagen es demasiado grande.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new FoodApiError('bad_request', 'No se ha podido leer esta imagen. Prueba con una foto en JPG o PNG.');
    }
    return toJpeg(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The current frame of the camera preview. */
export function prepareFrame(video: HTMLVideoElement): PreparedImage {
  if (!video.videoWidth) throw new FoodApiError('bad_request', 'La cámara aún no está lista.');
  return toJpeg(video, video.videoWidth, video.videoHeight);
}

// ── Calls ──────────────────────────────────────────────────────────────

/**
 * Sends the photo for recognition. Upload progress is real (bytes sent);
 * after that the server is identifying the foods.
 */
export function analyzePhoto(image: PreparedImage, opts: { hint?: string; onUpload?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<PhotoAnalysis> {
  return new Promise((resolve, reject) => {
    try {
      ensureOnline();
    } catch (e) {
      reject(e);
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/food-analyze`);
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.responseType = 'json';
    xhr.timeout = 40_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onUpload?.(e.loaded / e.total);
    };
    xhr.upload.onload = () => opts.onUpload?.(1);
    xhr.onload = () => {
      const body = xhr.response as { ok?: boolean; analysis?: unknown } | null;
      if (xhr.status !== 200 || body?.ok !== true) {
        reject(errorFrom(xhr.status, body));
        return;
      }
      try {
        resolve(parsePhotoAnalysis(body.analysis));
      } catch {
        reject(new FoodApiError('not_found', 'No hemos reconocido alimentos en la foto. Prueba con más luz o más cerca.'));
      }
    };
    xhr.onerror = () => reject(new FoodApiError(navigator.onLine === false ? 'offline' : 'unavailable', navigator.onLine === false ? MESSAGES.offline : MESSAGES.unavailable));
    xhr.ontimeout = () => reject(new FoodApiError('timeout', MESSAGES.timeout));
    xhr.onabort = () => reject(new FoodApiError('aborted', MESSAGES.aborted));
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(JSON.stringify({ image: image.base64, mediaType: 'image/jpeg', ...(opts.hint ? { hint: opts.hint } : {}) }));
  });
}

/** Re-checks a database food received from the server. */
function validFood(v: unknown): UsdaFood | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Partial<UsdaFood>;
  if (typeof f.fdcId !== 'number' || typeof f.description !== 'string' || !f.per100) return null;
  const n = f.per100 as Nutrients;
  if (!isPlausiblePer100(n)) return null;
  return { fdcId: f.fdcId, description: f.description.slice(0, 160), dataType: typeof f.dataType === 'string' ? f.dataType : '', per100: n };
}

export interface NutrientLookup {
  id: string;
  match: UsdaFood | null;
  alternatives: UsdaFood[];
  /** The search for this food failed (the others may have worked). */
  failed?: boolean;
}

export async function lookupNutrients(items: { id: string; query: string }[]): Promise<NutrientLookup[]> {
  const body = await request<{ results?: unknown[] }>('food-nutrients', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) }, 20_000);
  return (body.results ?? []).map((r) => {
    const row = (r ?? {}) as { id?: unknown; match?: unknown; alternatives?: unknown; error?: unknown };
    return {
      id: typeof row.id === 'string' ? row.id : '',
      match: validFood(row.match),
      alternatives: (Array.isArray(row.alternatives) ? row.alternatives : []).map(validFood).filter((f): f is UsdaFood => f !== null),
      ...(typeof row.error === 'string' ? { failed: true } : {}),
    };
  });
}

export interface FoodSearchResult {
  foods: UsdaFood[];
  /** Typical values estimated by the AI, offered when the database has little or nothing. */
  estimate: FoodReference | null;
}

export async function searchFoods(q: string): Promise<FoodSearchResult> {
  const body = await request<{ foods?: unknown[]; estimate?: unknown }>(`food-search?q=${encodeURIComponent(q)}`, {}, 25_000);
  const estimate = parseFoodReference(body.estimate);
  return {
    foods: (body.foods ?? []).map(validFood).filter((f): f is UsdaFood => f !== null),
    estimate: estimate?.per100 ? estimate : null,
  };
}

export interface ScannerStatus {
  /** Photos can be analysed. */
  vision: boolean;
  /** Values can be verified in USDA FoodData Central. */
  database: boolean;
}

let status: Promise<ScannerStatus | null> | null = null;

/** What the server can do, asked once per session (null when it cannot be known). */
export function scannerStatus(): Promise<ScannerStatus | null> {
  status ??= request<{ vision?: unknown; database?: unknown }>('food-status', {}, 8000)
    .then((b) => ({ vision: b.vision === true, database: b.database === true }))
    .catch((e: unknown) => {
      status = null;
      if (e instanceof FoodApiError && e.code === 'unavailable' && STANDALONE) return { vision: false, database: false };
      return null;
    });
  return status;
}

const OFF_FIELDS = 'code,product_name,product_name_es,generic_name,generic_name_es,brands,quantity,serving_size,serving_quantity,nutriments';

/**
 * Barcode lookup in Open Food Facts: through the RUMBO function, or straight
 * from the browser when the server is not reachable (only the code is sent).
 */
export async function lookupBarcode(code: string): Promise<OffProduct> {
  if (!isValidGtin(code)) throw new FoodApiError('bad_request', 'El código de barras no es válido. Revisa los números.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new FoodApiError('offline', MESSAGES.offline);
  if (!STANDALONE) {
    try {
      const body = await request<{ product?: unknown }>(`food-barcode?code=${code}`);
      const p = body.product as OffProduct | undefined;
      if (p && typeof p.name === 'string' && isPlausiblePer100(p.per100)) return p;
      throw new FoodApiError('not_found', 'Este producto no tiene información nutricional.');
    } catch (e) {
      if (!(e instanceof FoodApiError) || e.code !== 'unavailable') throw e;
    }
  }
  let res: Response;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=${OFF_FIELDS}`, { headers: { accept: 'application/json' } });
  } catch {
    throw new FoodApiError('offline', 'No se ha podido consultar Open Food Facts.');
  }
  const product = res.ok ? parseOffProduct(await res.json().catch(() => null), code) : null;
  if (!product) throw new FoodApiError('not_found', 'Este producto no está en Open Food Facts o no tiene información nutricional.');
  return product;
}
