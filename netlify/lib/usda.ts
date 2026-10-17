import { USDA_DATA_TYPES, parseUsdaSearch, type UsdaFood } from '../../src/domain/nutrition/usda';
import { fetchWithTimeout, HttpError } from './http';

const ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';

export function usdaConfigured(): boolean {
  return Boolean(process.env.USDA_FDC_API_KEY?.trim());
}

function checkStatus(res: Response): void {
  if (res.status === 429) throw new HttpError('rate_limited', 'La base de datos nutricional está recibiendo demasiadas consultas. Prueba en un minuto.', 429);
  if (res.status === 401 || res.status === 403) throw new HttpError('not_configured', 'La clave de la base de datos nutricional no es válida.', 503);
}

/**
 * Searches FoodData Central. `genericOnly` keeps to Survey (FNDDS), SR Legacy
 * and Foundation foods, which describe a food rather than one brand. Uses the
 * documented POST search (data types as a JSON array); if that is refused it
 * retries the plain GET search and filters the data types here.
 */
export async function searchUsda(query: string, opts: { genericOnly: boolean; pageSize?: number }): Promise<UsdaFood[]> {
  const key = process.env.USDA_FDC_API_KEY?.trim();
  if (!key) throw new HttpError('not_configured', 'La base de datos nutricional no está configurada en el servidor.', 503);
  const pageSize = opts.pageSize ?? 8;
  const keep = (foods: UsdaFood[]) => (opts.genericOnly ? foods.filter((f) => (USDA_DATA_TYPES as readonly string[]).includes(f.dataType)) : foods);

  const post = await fetchWithTimeout(`${ENDPOINT}?api_key=${encodeURIComponent(key)}`, {
    timeoutMs: 8000,
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ query, pageSize, ...(opts.genericOnly ? { dataType: [...USDA_DATA_TYPES] } : {}) }),
  });
  checkStatus(post);
  if (post.ok) return keep(parseUsdaSearch(await post.json()));

  const params = new URLSearchParams({ query, pageSize: String(opts.genericOnly ? pageSize * 3 : pageSize), api_key: key });
  const get = await fetchWithTimeout(`${ENDPOINT}?${params}`, { timeoutMs: 8000, headers: { accept: 'application/json' } });
  checkStatus(get);
  if (!get.ok) {
    console.error('[food] USDA search failed', post.status, get.status);
    throw new HttpError('upstream', 'La base de datos nutricional no ha respondido bien.', 502);
  }
  return keep(parseUsdaSearch(await get.json())).slice(0, pageSize);
}
