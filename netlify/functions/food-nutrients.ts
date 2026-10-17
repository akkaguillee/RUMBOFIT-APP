import { cleanQuery } from '../../src/domain/nutrition/analysis';
import { bestUsdaMatch } from '../../src/domain/nutrition/usda';
import { assertMethod, assertSameSite, handle, HttpError, json, readJson } from '../lib/http';
import { searchUsda, usdaConfigured } from '../lib/usda';

/**
 * POST { items: [{ id, query }] } → { ok, results: [{ id, match, alternatives, error? }] }
 * Values per 100 g from USDA FoodData Central for each identified food, used
 * to verify (or replace) the estimated values. Each food is looked up on its
 * own: one failed search never hides the results of the others.
 */

export default (req: Request) =>
  handle(async () => {
    assertMethod(req, 'POST');
    assertSameSite(req);
    if (!usdaConfigured()) throw new HttpError('not_configured', 'La base de datos nutricional no está configurada en el servidor.', 503);
    const body = (await readJson(req, 20_000)) as { items?: unknown } | null;
    const items = Array.isArray(body?.items) ? body.items.slice(0, 10) : [];
    const queries = items
      .map((raw) => {
        const it = (raw ?? {}) as Record<string, unknown>;
        return { id: typeof it.id === 'string' ? it.id.slice(0, 40) : '', query: cleanQuery(it.query) };
      })
      .filter((it) => it.id && it.query);
    if (!queries.length) throw new HttpError('bad_request', 'No hay alimentos que buscar.', 400);
    const settled = await Promise.allSettled(queries.map(({ query }) => searchUsda(query, { genericOnly: true, pageSize: 8 })));
    const results = queries.map(({ id, query }, i) => {
      const outcome = settled[i]!;
      if (outcome.status === 'rejected') {
        const code = outcome.reason instanceof HttpError ? outcome.reason.code : 'upstream';
        return { id, query, match: null, alternatives: [], error: code };
      }
      const match = bestUsdaMatch(outcome.value);
      return { id, query, match, alternatives: outcome.value.filter((f) => f !== match).slice(0, 4) };
    });
    // A key that is wrong fails every search the same way: report it as such.
    if (results.every((r) => r.error === 'not_configured')) throw new HttpError('not_configured', 'La clave de la base de datos nutricional no es válida.', 503);
    return json({ ok: true, results });
  });

// Static literal: Netlify reads this object without running the code.
export const config = {
  method: 'POST',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
