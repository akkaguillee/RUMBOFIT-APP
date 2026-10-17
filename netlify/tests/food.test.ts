// Lives outside netlify/functions: every file there is deployed as a function.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The functions run without network: fetch (USDA, Open Food Facts) and the
 * Anthropic SDK are replaced, so these tests check our handling of requests,
 * keys, upstream answers and errors — not the services themselves.
 */

const create = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status?: number;
    type?: string;
  }
  class APIConnectionError extends APIError {}
  class APIConnectionTimeoutError extends APIConnectionError {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class NotFoundError extends APIError {}
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static APIConnectionError = APIConnectionError;
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static NotFoundError = NotFoundError;
    static RateLimitError = RateLimitError;
    beta = { messages: { create } };
  }
  return { default: Anthropic };
});

const SITE = 'https://rumbofit.netlify.app';
const post = (path: string, body: unknown, origin = SITE) =>
  new Request(`${SITE}/.netlify/functions/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
const get = (path: string, origin = SITE) => new Request(`${SITE}/.netlify/functions/${path}`, { headers: { origin } });

const usdaHit = (fdcId: number, description: string, dataType: string, kcal = 154) => ({
  fdcId,
  description,
  dataType,
  foodNutrients: [
    { nutrientId: 1008, unitName: 'KCAL', value: kcal },
    { nutrientId: 1003, unitName: 'G', value: 10.6 },
    { nutrientId: 1004, unitName: 'G', value: 11.7 },
    { nutrientId: 1005, unitName: 'G', value: 1.4 },
  ],
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('USDA_FDC_API_KEY', 'test-usda-key');
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  create.mockReset();
});

describe('food-barcode', async () => {
  const { default: handler } = await import('../functions/food-barcode');

  it('returns the label values of a product', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        status: 1,
        product: { product_name: 'Nutella', brands: 'Ferrero', serving_size: '15 g', serving_quantity: 15, nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 } },
      }),
    );
    const res = await handler(get('food-barcode?code=3017620422003'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, product: { name: 'Nutella', servingGrams: 15, per100: { kcal: 539 } } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/3017620422003\?fields=/);
    expect((init as RequestInit).headers).toMatchObject({ 'user-agent': expect.stringMatching(/^RUMBO\//) });
  });

  it('rejects invalid codes, unknown products, other sites and other methods', async () => {
    expect((await handler(get('food-barcode?code=3017620422004'))).status).toBe(400);
    fetchMock.mockResolvedValue(Response.json({ status: 0, status_verbose: 'product not found' }));
    const missing = await handler(get('food-barcode?code=3017620422003'));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect((await handler(get('food-barcode?code=3017620422003', 'https://evil.example'))).status).toBe(403);
    expect((await handler(post('food-barcode?code=3017620422003', {}))).status).toBe(405);
  });
});

describe('food-nutrients', async () => {
  const { default: handler } = await import('../functions/food-nutrients');

  it('looks every food up in FoodData Central, generic foods first, without exposing the key', async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ foods: [usdaHit(1, 'EGG OMELET BRAND', 'Branded'), usdaHit(2, 'Omelet or scrambled egg, with cheese', 'Survey (FNDDS)')] }),
    );
    const res = await handler(post('food-nutrients', { items: [{ id: 'a', query: 'omelet cheese' }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ id: 'a', match: { fdcId: 2, per100: { kcal: 154, protein: 10.6 } }, alternatives: [{ fdcId: 1 }] });
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe('https://api.nal.usda.gov/fdc/v1/foods/search');
    expect(url.searchParams.get('dataType')).toBe('Survey (FNDDS),SR Legacy,Foundation');
    expect(url.searchParams.get('api_key')).toBe('test-usda-key');
    expect(JSON.stringify(body)).not.toContain('test-usda-key');
  });

  it('returns no match instead of guessing when the database has nothing', async () => {
    fetchMock.mockResolvedValue(Response.json({ foods: [] }));
    const body = await (await handler(post('food-nutrients', { items: [{ id: 'x', query: 'unknown dish' }] }))).json();
    expect(body.results[0]).toMatchObject({ id: 'x', match: null, alternatives: [] });
  });

  it('says clearly when the database is not configured or fails', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', '');
    const res = await handler(post('food-nutrients', { items: [{ id: 'a', query: 'rice' }] }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: 'not_configured' } });
    vi.stubEnv('USDA_FDC_API_KEY', 'k');
    fetchMock.mockResolvedValue(new Response('busy', { status: 429 }));
    expect((await handler(post('food-nutrients', { items: [{ id: 'a', query: 'rice' }] }))).status).toBe(429);
    fetchMock.mockRejectedValue(new TypeError('network'));
    expect((await handler(post('food-nutrients', { items: [{ id: 'a', query: 'rice' }] }))).status).toBe(502);
    expect((await handler(post('food-nutrients', { items: [] }))).status).toBe(400);
  });
});

describe('food-analyze', async () => {
  const { default: handler } = await import('../functions/food-analyze');
  const photo = { image: 'aGVsbG8=', mediaType: 'image/jpeg' };

  it('identifies foods with a structured answer from Claude and never asks it for nutrients', async () => {
    create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            is_food: true,
            image_quality: 'good',
            dish_name: 'Tortilla de patatas',
            items: [{ name_es: 'Tortilla de patatas', usda_query: 'omelet with potatoes', grams: 180, grams_confidence: 'medium', preparation: '' }],
            barcode: '',
            caveats: ['Puede llevar aceite que no se ve.'],
          }),
        },
      ],
    });
    const res = await handler(post('food-analyze', { ...photo, hint: 'es tortilla de patatas' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, analysis: { isFood: true, items: [{ name: 'Tortilla de patatas', grams: 180 }] } });
    const params = create.mock.calls[0]![0];
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
    expect(JSON.stringify(params.output_config.format.schema)).not.toMatch(/kcal|calor|protein/i);
    expect(params.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } });
    expect(params.messages[0].content[1].text).toContain('es tortilla de patatas');
  });

  it('maps refusals, missing keys, bad images and service errors to clear errors', async () => {
    create.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    expect((await handler(post('food-analyze', photo))).status).toBe(422);
    // The mocked classes above take just a message.
    const { default: Anthropic } = (await import('@anthropic-ai/sdk')) as unknown as { default: Record<'RateLimitError' | 'AuthenticationError', new (message: string) => Error> };
    create.mockRejectedValue(new Anthropic.RateLimitError('slow down'));
    expect((await handler(post('food-analyze', photo))).status).toBe(429);
    create.mockRejectedValue(new Anthropic.AuthenticationError('bad key'));
    expect(await (await handler(post('food-analyze', photo))).json()).toMatchObject({ error: { code: 'not_configured' } });
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] });
    expect((await handler(post('food-analyze', photo))).status).toBe(502);
    expect((await handler(post('food-analyze', { image: 'not base64!', mediaType: 'image/jpeg' }))).status).toBe(400);
    expect((await handler(post('food-analyze', { image: 'aGVsbG8=', mediaType: 'image/gif' }))).status).toBe(400);
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await handler(post('food-analyze', photo));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: 'not_configured' } });
  });

  it('refuses oversized bodies before reading them', async () => {
    const req = new Request(`${SITE}/.netlify/functions/food-analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: SITE, 'content-length': '9000000' },
      body: '{}',
    });
    expect((await handler(req)).status).toBe(413);
  });
});

describe('food-search', async () => {
  const { default: handler } = await import('../functions/food-search');

  it('translates a Spanish name once when the database finds nothing', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ foods: [] }))
      .mockResolvedValueOnce(Response.json({ foods: [usdaHit(5, 'Omelet, potato', 'Survey (FNDDS)', 160)] }));
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"usda_query":"omelet with potatoes"}' }] });
    const body = await (await handler(get('food-search?q=tortilla%20de%20patatas'))).json();
    expect(body).toMatchObject({ ok: true, query: 'omelet with potatoes', foods: [{ fdcId: 5 }] });
    expect(new URL(String(fetchMock.mock.calls[1]![0])).searchParams.get('query')).toBe('omelet with potatoes');
  });

  it('needs at least two letters', async () => {
    expect((await handler(get('food-search?q=a'))).status).toBe(400);
  });
});
