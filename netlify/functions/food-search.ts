import { cleanQuery } from '../../src/domain/nutrition/analysis';
import { assertMethod, assertSameSite, handle, HttpError, json } from '../lib/http';
import { searchUsda } from '../lib/usda';
import { translateFoodQuery, visionConfigured } from '../lib/vision';

/**
 * GET ?q=… → { ok, query, foods }
 * Lets the user pick the right food. FoodData Central is in English: when a
 * Spanish name finds nothing, it is translated to a database query once.
 */

export default (req: Request) =>
  handle(async () => {
    assertMethod(req, 'GET');
    assertSameSite(req);
    const q = cleanQuery(new URL(req.url).searchParams.get('q'));
    if (q.length < 2) throw new HttpError('bad_request', 'Escribe al menos dos letras.', 400);
    let query = q;
    let foods = await searchUsda(query, { genericOnly: false, pageSize: 12 });
    if (!foods.length && visionConfigured()) {
      const translated = await translateFoodQuery(q);
      if (translated && translated.toLowerCase() !== q.toLowerCase()) {
        query = translated;
        foods = await searchUsda(query, { genericOnly: false, pageSize: 12 });
      }
    }
    return json({ ok: true, query, foods: foods.slice(0, 10) });
  });

// Static literal: Netlify reads this object without running the code.
export const config = {
  method: 'GET',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
