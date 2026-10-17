import { USDA_DATA_TYPES, parseUsdaSearch, type UsdaFood } from '../../src/domain/nutrition/usda';
import { fetchWithTimeout, HttpError } from './http';

const ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';

export function usdaConfigured(): boolean {
  return Boolean(process.env.USDA_FDC_API_KEY);
}

/**
 * Searches FoodData Central. `genericOnly` keeps to Survey (FNDDS), SR Legacy
 * and Foundation foods, which describe a food rather than one brand.
 */
export async function searchUsda(query: string, opts: { genericOnly: boolean; pageSize?: number }): Promise<UsdaFood[]> {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key) throw new HttpError('not_configured', 'La base de datos nutricional no está configurada en el servidor.', 503);
  const params = new URLSearchParams({ query, pageSize: String(opts.pageSize ?? 8), api_key: key });
  if (opts.genericOnly) params.set('dataType', USDA_DATA_TYPES.join(','));
  const res = await fetchWithTimeout(`${ENDPOINT}?${params}`, { timeoutMs: 8000, headers: { accept: 'application/json' } });
  if (res.status === 429) throw new HttpError('rate_limited', 'La base de datos nutricional está recibiendo demasiadas consultas. Prueba en un minuto.', 429);
  if (res.status === 401 || res.status === 403) throw new HttpError('not_configured', 'La clave de la base de datos nutricional no es válida.', 503);
  if (!res.ok) throw new HttpError('upstream', 'La base de datos nutricional no ha respondido bien.', 502);
  return parseUsdaSearch(await res.json());
}
