/**
 * Small helpers shared by the food functions: JSON responses, a uniform error
 * shape the app understands, request size limits and a same-site check.
 */

export type ErrorCode =
  | 'not_configured'
  | 'bad_request'
  | 'too_large'
  | 'forbidden'
  | 'method'
  | 'rate_limited'
  | 'upstream'
  | 'refused'
  | 'timeout'
  | 'not_found';

const SECURITY_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: SECURITY_HEADERS });
}

export function fail(code: ErrorCode, message: string, status: number): Response {
  return json({ ok: false, error: { code, message } }, status);
}

/** Thrown inside handlers to answer with a specific error. */
export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Browsers send Origin on cross-site and POST requests: only this site (and
 * any origin listed in RUMBO_ALLOWED_ORIGINS, plus localhost for `netlify
 * dev`) may call the functions from a page. This does not stop scripted
 * clients, which is why each function also has a rate limit.
 */
export function assertSameSite(req: Request): void {
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  if (!origin) {
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') throw new HttpError('forbidden', 'Origen no permitido.', 403);
    return;
  }
  const own = new URL(req.url).origin;
  const extra = (process.env.RUMBO_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (origin !== own && !extra.includes(origin) && !local) throw new HttpError('forbidden', 'Origen no permitido.', 403);
}

export function assertMethod(req: Request, method: 'GET' | 'POST'): void {
  if (req.method !== method) throw new HttpError('method', 'Método no permitido.', 405);
}

/** Reads a JSON body without accepting more than `maxBytes`. */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new HttpError('too_large', 'La foto es demasiado grande.', 413);
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError('too_large', 'La foto es demasiado grande.', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError('bad_request', 'Solicitud no válida.', 400);
  }
}

/** Runs a handler and turns any failure into the uniform error shape (never leaking internals). */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof HttpError) return fail(e.code, e.message, e.status);
    console.error('[food] unexpected error', e instanceof Error ? e.message : e);
    return fail('upstream', 'No se ha podido completar el análisis. Inténtalo de nuevo.', 502);
  }
}

/** fetch with a deadline, mapped to HttpError on timeout or network failure. */
export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs: number }): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new HttpError('timeout', 'La base de datos nutricional tarda demasiado en responder.', 504);
    throw new HttpError('upstream', `No se ha podido contactar con la base de datos nutricional (${e instanceof Error ? e.name : 'red'}).`, 502);
  } finally {
    clearTimeout(timer);
  }
}
