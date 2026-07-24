// POST /v1/scans/ocr    — parse raw OCR text from a nutrition label
// POST /v1/scans/label  — parse a base64-encoded label image: uses pre-extracted on-device
//                          OCR text when its script is ML-Kit-supported, otherwise falls back
//                          to cloud vision OCR (Phase 6, ADR-0019)
// POST /v1/scans/meal   — identify dishes in a meal photo + estimate portions

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseLabelText, type ParsedLabel } from '../../scan/label-parser/parser.js';
import { tokenizeIngredients } from '../../scan/ingredient-parser/tokenizer.js';
import { parseAssist } from '../../scan/parse-assist.js';
import { analyseMealPhoto } from '../../scan/meal-photo/vision.js';
import { estimatePortion } from '../../scan/meal-photo/portioning.js';
import {
  scaleNutritionToPortion,
  sumMealNutrition,
  type PortionNutrition,
} from '../../scan/meal-photo/nutrient-scaling.js';
import { evaluateDiseaseRules, worstSeverity } from '../../engines/disease/index.js';
import { resolveByName } from '../../resolution/country-waterfall.js';
import { detectScript, needsCloudOcrFallback } from '../../scan/label-parser/script-detector.js';
import { extractLabelViaCloudVision } from '../../scan/label-parser/cloud-ocr-fallback.js';
import { extractTextViaGoogleVision } from '../../scan/label-parser/google-vision-ocr.js';
import {
  enrichLabelWithGemini,
  extractSearchQueryHeuristic,
  type LabelEnrichmentResult,
} from '../../scan/label-parser/gemini-enrichment.js';
import { buildNutritionCitation } from '../../nutrition/citation.js';
import { ok, err } from '@nutrimind/shared';

// Same country-aware wiring as routes/v1/resolve.ts (ADR-0033 §11) — byte-identical to the plain
// waterfall when `global.p3.unified_food_schema` is off (its default).
const FLAG_KEY = 'global.p3.unified_food_schema';
const FLAG_CACHE_TTL_MS = 5 * 60 * 1000;

let _flagEnabled = false;
let _cacheExpiry = 0;

async function isUnifiedFoodSchemaEnabled(supabase: SupabaseClient): Promise<boolean> {
  if (Date.now() < _cacheExpiry) return _flagEnabled;

  try {
    const { data } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', FLAG_KEY)
      .is('country_code', null)
      .maybeSingle();

    _flagEnabled = data?.enabled ?? false;
  } catch {
    _flagEnabled = false; // fail closed: default to the existing, already-live behavior
  }

  _cacheExpiry = Date.now() + FLAG_CACHE_TTL_MS;
  return _flagEnabled;
}

/** Reset the flag cache — for testing only. */
export function _resetScansUnifiedFoodSchemaFlagCache(): void {
  _flagEnabled = false;
  _cacheExpiry = 0;
}

// Gemini label-enrichment flag (Gemini integration, migration 0033) — same cache pattern as
// isUnifiedFoodSchemaEnabled above. Default off: byte-identical to the pre-enrichment response.
const ENRICHMENT_FLAG_KEY = 'global.p14.gemini_label_enrichment';
let _enrichmentFlagEnabled = false;
let _enrichmentCacheExpiry = 0;

async function isGeminiLabelEnrichmentEnabled(supabase: SupabaseClient): Promise<boolean> {
  if (Date.now() < _enrichmentCacheExpiry) return _enrichmentFlagEnabled;

  try {
    const { data } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', ENRICHMENT_FLAG_KEY)
      .is('country_code', null)
      .maybeSingle();

    _enrichmentFlagEnabled = data?.enabled ?? false;
  } catch {
    _enrichmentFlagEnabled = false; // fail closed
  }

  _enrichmentCacheExpiry = Date.now() + FLAG_CACHE_TTL_MS;
  return _enrichmentFlagEnabled;
}

/** Reset the flag cache — for testing only. */
export function _resetGeminiLabelEnrichmentFlagCache(): void {
  _enrichmentFlagEnabled = false;
  _enrichmentCacheExpiry = 0;
}

// Google Vision OCR flag (Gemini/Vision integration, migration 0034) — same cache pattern as
// above. Default off, and additionally gated on `fastify.googleVisionApiKey` being configured:
// byte-identical to the pre-Vision gateway-based cloud-OCR path otherwise.
const VISION_OCR_FLAG_KEY = 'global.p14.google_vision_ocr';
let _visionOcrFlagEnabled = false;
let _visionOcrCacheExpiry = 0;

async function isGoogleVisionOcrEnabled(supabase: SupabaseClient): Promise<boolean> {
  if (Date.now() < _visionOcrCacheExpiry) return _visionOcrFlagEnabled;

  try {
    const { data } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', VISION_OCR_FLAG_KEY)
      .is('country_code', null)
      .maybeSingle();

    _visionOcrFlagEnabled = data?.enabled ?? false;
  } catch {
    _visionOcrFlagEnabled = false; // fail closed
  }

  _visionOcrCacheExpiry = Date.now() + FLAG_CACHE_TTL_MS;
  return _visionOcrFlagEnabled;
}

/** Reset the flag cache — for testing only. */
export function _resetGoogleVisionOcrFlagCache(): void {
  _visionOcrFlagEnabled = false;
  _visionOcrCacheExpiry = 0;
}

const OcrBodySchema = z.object({
  rawText: z.string().min(10).max(8000),
  ingredientsText: z.string().max(2000).optional(),
  scanId: z.string().uuid().optional(),
  requestAssist: z.boolean().default(false),
});

const MealPhotoBodySchema = z.object({
  imageBase64: z.string().min(100),
  imageMediaType: z
    .enum(['image/jpeg', 'image/png', 'image/webp'])
    .default('image/jpeg'),
  scanId: z.string().uuid().optional(),
});

const LabelImageBodySchema = z.object({
  imageBase64: z.string().min(100),
  imageMediaType: z
    .enum(['image/jpeg', 'image/png', 'image/webp'])
    .default('image/jpeg'),
  // Pre-extracted on-device OCR text (ML Kit), when the client already attempted it.
  onDeviceOcrText: z.string().max(8000).optional(),
  scanId: z.string().uuid().optional(),
});

/** Shared by both the on-device-OCR path and the (flagged) Google Vision OCR path: runs the
 *  deterministic dataset match FIRST (resolveByName + buildNutritionCitation, real citation or
 *  null), then the Gemini enrichment call — identical logic either way, since neither cares
 *  which OCR source produced the text. Returns null (never throws) when the enrichment flag is
 *  off, the gateway isn't configured, or anything in the chain fails — callers simply omit the
 *  `enrichment` key from their response in that case. */
async function buildGeminiEnrichment(opts: {
  fastify: FastifyInstance;
  request: FastifyRequest;
  ocrText: string;
  parsed: ParsedLabel;
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  traceId: string;
}): Promise<LabelEnrichmentResult | null> {
  const { fastify, request, ocrText, parsed, imageBase64, imageMediaType, traceId } = opts;
  if (!fastify.gateway || !(await isGeminiLabelEnrichmentEnabled(fastify.supabase))) return null;

  try {
    const searchQuery = extractSearchQueryHeuristic(ocrText);
    let citation = null;
    let matchedProductName: string | null = null;
    if (searchQuery) {
      const engineEnabled = await isUnifiedFoodSchemaEnabled(fastify.supabase);
      const matchResult = await resolveByName(searchQuery, request.country, {
        sql: fastify.sql,
        offClient: fastify.offClient,
        ifct: fastify.ifct,
        usdaClient: fastify.usdaClient,
        cofid: fastify.cofid,
      }, { engineEnabled });
      if (matchResult.resolvedBy !== 'not_found' && matchResult.product) {
        matchedProductName = matchResult.product.name;
        citation = await buildNutritionCitation(fastify.sql, matchResult.product);
      }
    }
    return await enrichLabelWithGemini({
      imageBase64,
      imageMediaType,
      ocrText,
      parsedLabel: parsed,
      citation,
      matchedProductName,
      locale: request.country.locale,
      gateway: fastify.gateway,
      traceId,
    });
  } catch (e) {
    fastify.log.warn({ err: e }, '[gemini-enrichment] failed; continuing without AI enrichment');
    return null;
  }
}

export default async function scanRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /v1/scans/ocr
  fastify.post<{ Body: unknown }>('/scans/ocr', async (request, reply) => {
    const body = OcrBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    const { rawText, ingredientsText, requestAssist } = body.data;

    // Step 1: regex-based deterministic extraction
    const parsed = parseLabelText(rawText);

    // Step 2: optional LLM parse-assist for low-confidence fields
    let assistResult = null;
    if (requestAssist && parsed.lowConfidenceFields.length > 0 && fastify.gateway) {
      try {
        assistResult = await parseAssist(
          {
            rawText,
            missingFields: parsed.lowConfidenceFields,
            labelContext: rawText,
          },
          fastify.gateway,
        );
      } catch (e) {
        fastify.log.warn({ err: e }, '[parse-assist] failed; continuing without LLM assist');
      }
    }

    // Step 3: ingredient tokenisation
    const ingredients = ingredientsText ? tokenizeIngredients(ingredientsText) : [];

    return reply.send(
      ok({
        nutrition: parsed.nutrition,
        fieldConfidence: parsed.fieldConfidence,
        overallConfidence: parsed.overallConfidence,
        wasPerServing: parsed.wasPerServing,
        servingSizeG: parsed.servingSizeG,
        lowConfidenceFields: parsed.lowConfidenceFields,
        needsUserConfirmation: parsed.overallConfidence < 0.5,
        ingredients: ingredients.map((t) => ({
          name: t.name,
          percentage: t.percentage,
          subIngredients: t.subIngredients.map((s) => ({ name: s.name, percentage: s.percentage })),
        })),
        assistHints: assistResult?.hints ?? [],
        productNameGuess: assistResult?.productNameGuess ?? null,
        brandGuess: assistResult?.brandGuess ?? null,
      }),
    );
  });

  // POST /v1/scans/label
  fastify.post<{ Body: unknown }>('/scans/label', async (request, reply) => {
    const body = LabelImageBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    const { imageBase64, imageMediaType, onDeviceOcrText } = body.data;
    const traceId = (request as { id?: string }).id ?? crypto.randomUUID();

    // Step 1: if the client already has on-device OCR text, check whether its script is one
    // ML Kit handles natively. If so, the free deterministic path is strictly better than a
    // cloud call — same text, zero cost, byte-identical to /scans/ocr's behavior.
    const script = onDeviceOcrText ? detectScript(onDeviceOcrText) : null;
    if (onDeviceOcrText && script && !needsCloudOcrFallback(script)) {
      const parsed = parseLabelText(onDeviceOcrText);

      // Optional Gemini enrichment (Gemini integration, flag `global.p14.gemini_label_enrichment`,
      // default off) — layered on top of the deterministic parse above, never replacing it. Flag
      // off (or gateway unconfigured) skips this block entirely: response is byte-identical to
      // the pre-enrichment shape.
      const enrichment = await buildGeminiEnrichment({
        fastify, request, ocrText: onDeviceOcrText, parsed, imageBase64, imageMediaType, traceId,
      });

      return reply.send(
        ok({
          nutrition: parsed.nutrition,
          fieldConfidence: parsed.fieldConfidence,
          overallConfidence: parsed.overallConfidence,
          wasPerServing: parsed.wasPerServing,
          servingSizeG: parsed.servingSizeG,
          lowConfidenceFields: parsed.lowConfidenceFields,
          labelFormat: parsed.labelFormat,
          needsUserConfirmation: parsed.overallConfidence < 0.5,
          detectedScript: script,
          usedCloudOcr: false,
          ...(enrichment ? { enrichment } : {}),
        }),
      );
    }

    // Step 2: cloud OCR fallback — no usable on-device text, or its script isn't
    // ML-Kit-supported (e.g. Arabic, Tamil, Telugu packaging).

    // Optional Google Vision OCR path (Gemini/Vision integration, flag
    // `global.p14.google_vision_ocr`, default off, additionally gated on
    // `fastify.googleVisionApiKey` being configured). Real OCR text extraction runs through the
    // SAME deterministic parseLabelText() the on-device path uses above — a more verifiable path
    // than asking an LLM to read+parse the image in one call — then the same Gemini enrichment
    // helper as Step 1. Flag off, key absent, no text found, or any failure: falls through
    // unchanged to the existing gateway-based cloud-OCR path below — byte-identical to current
    // behavior in every one of those cases.
    if (fastify.googleVisionApiKey && (await isGoogleVisionOcrEnabled(fastify.supabase))) {
      try {
        const visionResult = await extractTextViaGoogleVision({
          imageBase64, apiKey: fastify.googleVisionApiKey,
        });
        if (visionResult.available && visionResult.text) {
          const parsed = parseLabelText(visionResult.text);
          const enrichment = await buildGeminiEnrichment({
            fastify, request, ocrText: visionResult.text, parsed, imageBase64, imageMediaType, traceId,
          });

          return reply.send(
            ok({
              nutrition: parsed.nutrition,
              fieldConfidence: parsed.fieldConfidence,
              overallConfidence: parsed.overallConfidence,
              wasPerServing: parsed.wasPerServing,
              servingSizeG: parsed.servingSizeG,
              lowConfidenceFields: parsed.lowConfidenceFields,
              labelFormat: parsed.labelFormat,
              needsUserConfirmation: true, // Vision-derived OCR is always a suggestion, never auto-trusted
              detectedScript: script,
              usedCloudOcr: true,
              usedGoogleVisionOcr: true,
              ...(enrichment ? { enrichment } : {}),
            }),
          );
        }
        fastify.log.warn({ traceId, note: visionResult.note }, '[google-vision-ocr] no text extracted; falling back to gateway-based cloud OCR');
      } catch (e) {
        fastify.log.warn({ err: e }, '[google-vision-ocr] failed; falling back to gateway-based cloud OCR');
      }
    }

    if (!fastify.gateway) {
      return reply
        .status(503)
        .send(err('GATEWAY_UNAVAILABLE', 'AI gateway not configured; set at least one LLM provider key'));
    }
    const cloudResult = await extractLabelViaCloudVision({
      imageBase64, imageMediaType, gateway: fastify.gateway, traceId,
    });

    return reply.send(
      ok({
        nutrition: cloudResult.nutrition,
        fieldConfidence: cloudResult.fieldConfidence,
        overallConfidence: cloudResult.overallConfidence,
        wasPerServing: cloudResult.wasPerServing,
        servingSizeG: cloudResult.servingSizeG,
        lowConfidenceFields: cloudResult.lowConfidenceFields,
        labelFormat: cloudResult.labelFormat,
        needsUserConfirmation: true, // cloud OCR result is always a suggestion, never auto-trusted
        detectedScript: script,
        usedCloudOcr: true,
      }),
    );
  });

  // POST /v1/scans/meal
  fastify.post<{ Body: unknown }>('/scans/meal', async (request, reply) => {
    if (!fastify.gateway) {
      return reply
        .status(503)
        .send(err('GATEWAY_UNAVAILABLE', 'AI gateway not configured; set at least one LLM provider key'));
    }

    const body = MealPhotoBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    const { imageBase64, imageMediaType } = body.data;
    const traceId = (request as { id?: string }).id ?? crypto.randomUUID();

    // Step 1: identify dishes
    const vision = await analyseMealPhoto(imageBase64, imageMediaType, fastify.gateway, traceId);

    if (!vision.isFood) {
      return reply.status(422).send(err('NOT_FOOD', 'The image does not appear to contain food.'));
    }

    // Step 2: estimate portions
    const portionEstimates = vision.candidates.map((c) =>
      estimatePortion(c.name, c.portionSizeHint),
    );

    // Step 3: resolve nutrition for EVERY candidate above the confidence floor (in parallel) —
    // a meal photo usually contains several dishes, and per-dish + whole-meal nutrition is the
    // entire point of the feature. Previously only the top candidate was resolved.
    const RESOLVE_CONFIDENCE_FLOOR = 0.4;
    const engineEnabled = await isUnifiedFoodSchemaEnabled(fastify.supabase);
    const resolutions = await Promise.all(
      vision.candidates.map(async (c) => {
        if (c.confidence < RESOLVE_CONFIDENCE_FLOOR) return null;
        try {
          const result = await resolveByName(c.searchQuery, request.country, {
            sql: fastify.sql,
            offClient: fastify.offClient,
            ifct: fastify.ifct,
            usdaClient: fastify.usdaClient,
            cofid: fastify.cofid,
          }, { engineEnabled });
          if (result.resolvedBy !== 'not_found' && result.product?.nutrition) {
            return {
              nutrition: result.product.nutrition,
              ingredientsText: result.product.ingredientsRawText,
              resolvedBy: result.resolvedBy,
              citation: await buildNutritionCitation(fastify.sql, result.product),
            };
          }
        } catch (e) {
          fastify.log.warn({ err: e, dish: c.name }, '[meal-scan] nutrition resolution failed for dish');
        }
        return null;
      }),
    );

    // Step 4: scale each resolved dish's per-100g panel to its estimated portion, then total.
    const portionPanels: PortionNutrition[] = [];
    const scaledByIndex: (PortionNutrition | null)[] = resolutions.map((r, i) => {
      const grams = portionEstimates[i]?.portionGrams;
      if (!r || !grams) return null;
      const panel = scaleNutritionToPortion(r.nutrition, grams);
      portionPanels.push(panel);
      return panel;
    });
    const mealTotals = portionPanels.length > 0 ? sumMealNutrition(portionPanels) : null;

    // Step 5 (disease-aware, authenticated callers only): evaluate the user's stored conditions
    // per dish and against the whole-meal totals. Best-effort — never blocks the scan result.
    const userId = (request as { user?: { id?: string } }).user?.id;
    let userConditions: string[] = [];
    let userMedications: string[] = [];
    let userReproductiveStatus: string | null = null;
    if (userId) {
      try {
        const { data } = await fastify.supabase
          .from('users_profiles')
          .select('conditions, medications, reproductive_status')
          .eq('id', userId)
          .maybeSingle();
        userConditions = (data?.conditions as string[] | null) ?? [];
        userMedications = (data?.medications as string[] | null) ?? [];
        userReproductiveStatus = (data?.reproductive_status as string | null) ?? null;
      } catch { /* profile fetch is best-effort */ }
    }
    const hasDiseaseSignal = userConditions.length > 0 || Boolean(userReproductiveStatus);
    const diseaseNotesByIndex = resolutions.map((r) => {
      if (!r || !hasDiseaseSignal) return null;
      const evals = evaluateDiseaseRules({
        nutrition: r.nutrition,
        ingredientsText: r.ingredientsText,
        conditions: userConditions,
        medications: userMedications,
        reproductiveStatus: userReproductiveStatus,
      });
      const triggered = evals.filter((e) => e.triggered);
      return triggered.length > 0 ? triggered : null;
    });
    const mealSuitability = (() => {
      if (!hasDiseaseSignal || !mealTotals) return null;
      // Totals are per-meal, and the rules read per-100g — normalise back so thresholds hold.
      const factor = mealTotals.totalPortionGrams > 0 ? 100 / mealTotals.totalPortionGrams : 0;
      if (factor === 0) return null;
      const per100g = {
        energyKcal: mealTotals.energyKcal != null ? mealTotals.energyKcal * factor : null,
        proteinG: mealTotals.proteinG != null ? mealTotals.proteinG * factor : null,
        carbohydratesG: mealTotals.carbohydratesG != null ? mealTotals.carbohydratesG * factor : null,
        sugarsG: mealTotals.sugarsG != null ? mealTotals.sugarsG * factor : null,
        sugarsAddedG: mealTotals.sugarsAddedG != null ? mealTotals.sugarsAddedG * factor : null,
        dietaryFiberG: mealTotals.dietaryFiberG != null ? mealTotals.dietaryFiberG * factor : null,
        fatSaturatedG: mealTotals.fatSaturatedG != null ? mealTotals.fatSaturatedG * factor : null,
        fatTransG: mealTotals.fatTransG != null ? mealTotals.fatTransG * factor : null,
        sodiumMg: mealTotals.sodiumMg != null ? mealTotals.sodiumMg * factor : null,
        potassiumMg: mealTotals.potassiumMg != null ? mealTotals.potassiumMg * factor : null,
        cholesterolMg: mealTotals.cholesterolMg != null ? mealTotals.cholesterolMg * factor : null,
        vitaminAIu: mealTotals.vitaminAIu != null ? mealTotals.vitaminAIu * factor : null,
      };
      const evals = evaluateDiseaseRules({
        nutrition: per100g,
        conditions: userConditions,
        medications: userMedications,
        reproductiveStatus: userReproductiveStatus,
      });
      const triggered = evals.filter((e) => e.triggered);
      return {
        overall: worstSeverity(evals) ?? 'ok',
        notes: triggered,
      };
    })();

    // Backward compatibility: the original top-candidate fields are preserved verbatim.
    const top = vision.candidates[0];
    const topResolution = resolutions[0];

    return reply.send(
      ok({
        isFood: vision.isFood,
        isIndianFood: vision.isIndianFood,
        sceneDescription: vision.sceneDescription,
        candidates: vision.candidates.map((c, i) => ({
          name: c.name,
          nameLocalised: c.nameLocalised,
          confidence: c.confidence,
          cuisine: c.cuisine,
          portionEstimate: portionEstimates[i],
          // Per-dish nutrition (10-condition/meal-photo expansion, audit 2026-07)
          nutritionPer100g: resolutions[i]?.nutrition ?? null,
          nutritionForPortion: scaledByIndex[i],
          resolvedBy: resolutions[i]?.resolvedBy ?? null,
          citation: resolutions[i]?.citation ?? null,
          diseaseNotes: diseaseNotesByIndex[i],
        })),
        mealTotals,
        mealSuitability,
        topCandidateNutrition: topResolution?.nutrition ?? null,
        topCandidateResolvedBy: topResolution?.resolvedBy ?? null,
        topCandidateCitation: topResolution?.citation ?? null,
        needsUserConfirmation: !top || top.confidence < 0.75,
        notes: vision.notes,
        disclaimerRequired: true,
      }),
    );
  });
}
