import Anthropic from '@anthropic-ai/sdk';
import {
  AnalysisFormatError,
  FOOD_REFERENCE_SCHEMA,
  MAX_HINT_LENGTH,
  parseFoodReference,
  parsePhotoAnalysis,
  PHOTO_ANALYSIS_SCHEMA,
  type FoodReference,
  type PhotoAnalysis,
} from '../../src/domain/nutrition/analysis';
import { HttpError } from './http';

/**
 * Food recognition with Claude. The model identifies foods, estimates the
 * amount on the plate, gives typical values per 100 g from food composition
 * tables (shown in the app as estimates) and writes a search query so USDA
 * FoodData Central can verify them. The photo is only sent for this request
 * and is not stored.
 */

const MODEL = process.env.RUMBO_FOOD_MODEL || 'claude-opus-5-5';

const SYSTEM = `You analyse photos of meals and food products for RUMBO, a nutrition and habits app used in Spain.

For each distinct food or drink you can see:
- name_es: a short name in Spanish (Spain), e.g. "Tortilla de patatas", "Arroz blanco".
- usda_query: an English search query that matches a generic USDA FoodData Central entry for that food as prepared, e.g. "omelet with potatoes", "rice white cooked", "chicken breast grilled". Prefer generic or prepared-dish descriptions over brands.
- grams: the edible amount you estimate is on the plate, using visual cues (a dinner plate is about 26 cm, cutlery, glass size, typical portions).
- grams_confidence: "high" only when the amount is easy to judge (a whole fruit, a packaged item with visible size), "low" when the food is piled, hidden or partly out of frame.
- preparation: how it seems cooked ("frito", "a la plancha", "cocido", "crudo"…) or an empty string.
- per_100g: typical composition per 100 g of that food as prepared, as listed in standard food composition tables (USDA FoodData Central, BEDCA). Energy in kcal; protein, carbohydrates (total, including fibre and sugars), fat, saturated fat, fibre, sugars and alcohol in grams. Values are per 100 g, never for the portion. Energy must agree with the macronutrients (about 4 kcal/g protein and carbohydrates, 9 kcal/g fat, 7 kcal/g alcohol). Use 0 for alcohol in foods without it.
- center_x, center_y: the approximate centre of that food in the photo, as fractions of the image width and height (0,0 is the top-left corner, 1,1 the bottom-right).

Rules:
- If the photo does not show food, set is_food to false, image_quality to "not_food" and return no items.
- If the photo is too blurry or dark to identify the food, say so in image_quality and list only what you can recognise.
- Do not invent ingredients you cannot see. Mention what a photo cannot show (cooking oil, sauces, fillings, portion depth) in caveats, in Spanish, briefly.
- dish_name: one short Spanish name for the whole plate.
- barcode: the digits printed under a product barcode only if they are fully legible; otherwise an empty string.
- At most 10 items. A user hint, if present, describes the photo; trust it for identification but still estimate amounts from the image.`;

export function visionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function client(): Anthropic {
  if (!visionConfigured()) throw new HttpError('not_configured', 'El análisis por foto no está configurado en el servidor.', 503);
  // A function has 30 s; leave room for the database lookups and the reply.
  return new Anthropic({ maxRetries: 1, timeout: 24_000 });
}

function mapError(e: unknown): never {
  if (e instanceof HttpError) throw e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    throw new HttpError('not_configured', 'La clave del servicio de análisis no es válida.', 503);
  }
  if (e instanceof Anthropic.NotFoundError) throw new HttpError('not_configured', 'El modelo de análisis configurado no está disponible.', 503);
  if (e instanceof Anthropic.RateLimitError) throw new HttpError('rate_limited', 'El servicio de análisis está ocupado. Prueba de nuevo en un momento.', 429);
  if (e instanceof Anthropic.APIConnectionTimeoutError) throw new HttpError('timeout', 'El análisis está tardando demasiado. Prueba con otra foto o más tarde.', 504);
  if (e instanceof Anthropic.APIConnectionError) throw new HttpError('upstream', 'No se ha podido contactar con el servicio de análisis.', 502);
  if (e instanceof Anthropic.APIError) {
    console.error('[food] analysis API error', e.status, e.type);
    throw new HttpError('upstream', 'El servicio de análisis no ha podido procesar la foto.', 502);
  }
  throw e;
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  for (const block of content) if (block.type === 'text') return block.text;
  return '';
}

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export async function analyzePhoto(image: { data: string; mediaType: ImageMediaType }, hint?: string): Promise<PhotoAnalysis> {
  const api = client();
  const note = hint?.trim().slice(0, MAX_HINT_LENGTH);
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await api.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // A refused request is retried server-side on the recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Recognition is a quick visual task: low effort keeps it fast.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: PHOTO_ANALYSIS_SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
            { type: 'text', text: note ? `User hint about this photo: «${note}»` : 'Analyse this photo.' },
          ],
        },
      ],
    });
  } catch (e) {
    mapError(e);
  }
  if (response.stop_reason === 'refusal') throw new HttpError('refused', 'No se ha podido analizar esta foto. Prueba con otra imagen del plato.', 422);
  if (response.stop_reason === 'max_tokens') throw new HttpError('upstream', 'El análisis no se completó. Inténtalo de nuevo.', 502);
  try {
    return parsePhotoAnalysis(JSON.parse(textOf(response.content)));
  } catch (e) {
    if (e instanceof AnalysisFormatError) throw new HttpError('not_found', 'No hemos reconocido alimentos en la foto. Prueba con más luz o más cerca.', 422);
    throw new HttpError('upstream', 'La respuesta del análisis no es válida. Inténtalo de nuevo.', 502);
  }
}

/**
 * A food typed by the user (usually in Spanish): an English query for
 * FoodData Central and typical values per 100 g, used as an estimate when
 * the database has no entry or is not configured.
 */
export async function referenceFood(text: string): Promise<FoodReference | null> {
  const api = client();
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await api.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: FOOD_REFERENCE_SCHEMA } },
      system:
        'The user names a food or dish, usually in Spanish. Reply with: is_food (false if it is not a food or drink); name_es, a short Spanish name; usda_query, a short English query that matches a generic USDA FoodData Central entry for it as usually eaten (e.g. "tortilla de patatas" → "omelet with potatoes"); per_100g, its typical composition per 100 g as listed in standard food composition tables (USDA, BEDCA): kcal, and grams of protein, total carbohydrates, fat, saturated fat, fibre, sugars and alcohol. Energy must agree with the macronutrients.',
      messages: [{ role: 'user', content: text.slice(0, 80) }],
    });
  } catch (e) {
    mapError(e);
  }
  if (response.stop_reason !== 'end_turn') return null;
  try {
    return parseFoodReference(JSON.parse(textOf(response.content)));
  } catch {
    return null;
  }
}
