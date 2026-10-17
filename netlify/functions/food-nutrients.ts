import { cleanQuery } from '../../src/domain/nutrition/analysis';
import { bestUsdaMatch } from '../../src/domain/nutrition/usda';
import { assertMethod, assertSameSite, handle, HttpError, json, readJson } from '../lib/http';
import { searchUsda } from '../lib/usda';

/**
 * POST { items: [{ id, query }] } → { ok, results: [{ id, match, alternatives }] }
 * Values per 100 g from USDA FoodData Central for each identified food.
 * `match` is null when the database has no reliable entry: the app then asks
 * the user to pick or correct the food instead of guessing values.
 */

export default (req: Request) =>
  handle(async () => {
    assertMethod(req, 'POST');
    assertSameSite(req);
    const body = (await readJson(req, 20_000)) as { items?: unknown } | null;
    const items = Array.isArray(body?.items) ? body.items.slice(0, 10) : [];
    const queries = items
      .map((raw) => {
        const it = (raw ?? {}) as Record<string, unknown>;
        return { id: typeof it.id === 'string' ? it.id.slice(0, 40) : '', query: cleanQuery(it.query) };
      })
      .filter((it) => it.id && it.query);
    if (!queries.length) throw new HttpError('bad_request', 'No hay alimentos que buscar.', 400);
    const results = await Promise.all(
      queries.map(async ({ id, query }) => {
        const foods = await searchUsda(query, { genericOnly: true, pageSize: 8 });
        const match = bestUsdaMatch(foods);
        return { id, query, match, alternatives: foods.filter((f) => f !== match).slice(0, 4) };
      }),
    );
    return json({ ok: true, results });
  });

// Static literal: Netlify reads this object without running the code.
export const config = {
  method: 'POST',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
