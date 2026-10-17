import { cleanQuery, type FoodReference } from '../../src/domain/nutrition/analysis';
import type { UsdaFood } from '../../src/domain/nutrition/usda';
import { assertMethod, assertSameSite, handle, HttpError, json } from '../lib/http';
import { searchUsda, usdaConfigured } from '../lib/usda';
import { referenceFood, visionConfigured } from '../lib/vision';

/**
 * GET ?q=… → { ok, query, foods, estimate }
 * Lets the user pick the right food. FoodData Central is in English, so the
 * typed name is also turned into a database query by the AI, which returns
 * typical values per 100 g as well: those are offered, clearly marked as an
 * estimate, when the database finds nothing or is not configured.
 */

export default (req: Request) =>
  handle(async () => {
    assertMethod(req, 'GET');
    assertSameSite(req);
    const q = cleanQuery(new URL(req.url).searchParams.get('q'));
    if (q.length < 2) throw new HttpError('bad_request', 'Escribe al menos dos letras.', 400);
    const database = usdaConfigured();
    let query = q;
    let foods: UsdaFood[] = [];
    if (database) foods = await searchUsda(query, { genericOnly: false, pageSize: 12 }).catch(() => []);
    let estimate: FoodReference | null = null;
    if (foods.length < 3 && visionConfigured()) {
      estimate = await referenceFood(q);
      if (database && !foods.length && estimate?.query && estimate.query.toLowerCase() !== q.toLowerCase()) {
        query = estimate.query;
        foods = await searchUsda(query, { genericOnly: false, pageSize: 12 }).catch(() => []);
      }
    }
    if (!database && !visionConfigured()) throw new HttpError('not_configured', 'La búsqueda de alimentos no está configurada en el servidor.', 503);
    return json({ ok: true, query, foods: foods.slice(0, 10), estimate: estimate?.per100 ? estimate : null });
  });

// Static literal: Netlify reads this object without running the code.
export const config = {
  method: 'GET',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
