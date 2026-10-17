import { parseOffProduct, type OffProduct } from '../../src/domain/nutrition/off';
import { fetchWithTimeout, HttpError } from './http';

const FIELDS = [
  'code',
  'product_name',
  'product_name_es',
  'generic_name',
  'generic_name_es',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'nutriments',
].join(',');

/** Looks a barcode up in Open Food Facts (public data, no key; identified as RUMBO as their terms ask). */
export async function fetchOffProduct(code: string): Promise<OffProduct | null> {
  const res = await fetchWithTimeout(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=${FIELDS}`, {
    timeoutMs: 8000,
    headers: { accept: 'application/json', 'user-agent': 'RUMBO/1.0 (https://rumbofit.netlify.app)' },
  });
  if (res.status === 404) return null;
  if (res.status === 429) throw new HttpError('rate_limited', 'Open Food Facts está recibiendo demasiadas consultas. Prueba en un minuto.', 429);
  if (!res.ok) throw new HttpError('upstream', 'Open Food Facts no ha respondido bien.', 502);
  return parseOffProduct(await res.json(), code);
}
