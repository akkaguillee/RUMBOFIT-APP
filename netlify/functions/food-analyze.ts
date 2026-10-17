import { assertMethod, assertSameSite, handle, HttpError, json, readJson } from '../lib/http';
import { analyzePhoto, type ImageMediaType } from '../lib/vision';

/**
 * POST { image: base64, mediaType, hint? } → { ok, analysis }
 * Identifies the foods in a photo and estimates their amounts. Nothing is stored.
 */

const MAX_BODY = 4_500_000; // ~3.3 MB image once decoded; the app sends ~200–400 kB
const TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

export default (req: Request) =>
  handle(async () => {
    assertMethod(req, 'POST');
    assertSameSite(req);
    const body = (await readJson(req, MAX_BODY)) as Record<string, unknown> | null;
    const data = typeof body?.image === 'string' ? body.image : '';
    const mediaType = TYPES.find((t) => t === body?.mediaType);
    if (!data || !mediaType || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new HttpError('bad_request', 'La imagen no es válida.', 400);
    const hint = typeof body?.hint === 'string' ? body.hint : undefined;
    const analysis = await analyzePhoto({ data, mediaType }, hint);
    return json({ ok: true, analysis });
  });

// Static literal: Netlify reads this object without running the code.
export const config = {
  method: 'POST',
  rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
