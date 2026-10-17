import { assertMethod, assertSameSite, handle, json } from '../lib/http';
import { usdaConfigured } from '../lib/usda';
import { visionConfigured } from '../lib/vision';

/**
 * GET → { ok, vision, database }
 * Which parts of the scanner the server can run, so the app can say so before
 * the user takes a photo. Only booleans: never the keys themselves.
 */

export default (req: Request) =>
  handle(async () => {
    assertMethod(req, 'GET');
    assertSameSite(req);
    return json({ ok: true, vision: visionConfigured(), database: usdaConfigured() });
  });

// Static literal: Netlify reads this object without running the code.
export const config = {
  method: 'GET',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
