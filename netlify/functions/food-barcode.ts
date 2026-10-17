import { isValidGtin, normalizeBarcode } from '../../src/domain/nutrition/barcode';
import { assertMethod, assertSameSite, handle, HttpError, json } from '../lib/http';
import { fetchOffProduct } from '../lib/off';

/** GET ?code=… → { ok, product } from Open Food Facts (label values per 100 g and per serving). */

export default (req: Request) =>
  handle(async () => {
    assertMethod(req, 'GET');
    assertSameSite(req);
    const code = normalizeBarcode(new URL(req.url).searchParams.get('code') ?? '');
    if (!isValidGtin(code)) throw new HttpError('bad_request', 'El código de barras no es válido.', 400);
    const product = await fetchOffProduct(code);
    if (!product) throw new HttpError('not_found', 'Este producto no está en Open Food Facts o no tiene información nutricional.', 404);
    return json({ ok: true, product });
  });

// Static literal: Netlify reads this object without running the code.
export const config = {
  method: 'GET',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
