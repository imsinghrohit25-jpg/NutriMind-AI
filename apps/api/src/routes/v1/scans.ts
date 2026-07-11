// POST /v1/scans/ocr    — parse raw OCR text from a nutrition label
// POST /v1/scans/label  — parse a base64-encoded label image: uses pre-extracted on-device
//                          OCR text when its script is ML-Kit-supported, otherwise falls back
//                          to cloud vision OCR (Phase 6, ADR-0019)
// POST /v1/scans/meal   — identify dishes in a meal photo + estimate portions

import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseLabelText } from '../../scan/label-parser/parser.js';
import { tokenizeIngredients } from '../../scan/ingredient-parser/tokenizer.js';
import { parseAssist } from '../../scan/parse-assist.js';
import { analyseMealPhoto } from '../../scan/meal-photo/vision.js';
import { estimatePortion } from '../../scan/meal-photo/portioning.js';
import { resolveByName } from '../../resolution/country-waterfall.js';
import { detectScript, needsCloudOcrFallback } from '../../scan/label-parser/script-detector.js';
import { extractLabelViaCloudVision } from '../../scan/label-parser/cloud-ocr-fallback.js';
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
        }),
      );
    }

    // Step 2: cloud OCR fallback — no usable on-device text, or its script isn't
    // ML-Kit-supported (e.g. Arabic, Tamil, Telugu packaging).
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

    // Step 3: resolve nutrition for top candidate (by confidence)
    const top = vision.candidates[0];
    let nutrition = null;
    let resolvedBy = null;
    // Real source citation (ADR-0033 addendum §B) — null when nothing was resolved, never a
    // placeholder attribution.
    let citation = null;
    if (top && top.confidence >= 0.4) {
      try {
        const engineEnabled = await isUnifiedFoodSchemaEnabled(fastify.supabase);
        const result = await resolveByName(top.searchQuery, request.country, {
          sql: fastify.sql,
          offClient: fastify.offClient,
          ifct: fastify.ifct,
          usdaClient: fastify.usdaClient,
          cofid: fastify.cofid,
        }, { engineEnabled });
        if (result.resolvedBy !== 'not_found' && result.product?.nutrition) {
          nutrition = result.product.nutrition;
          resolvedBy = result.resolvedBy;
          citation = await buildNutritionCitation(fastify.sql, result.product);
        }
      } catch (e) {
        fastify.log.warn({ err: e }, '[meal-scan] nutrition resolution failed for top dish');
      }
    }

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
        })),
        topCandidateNutrition: nutrition,
        topCandidateResolvedBy: resolvedBy,
        topCandidateCitation: citation,
        needsUserConfirmation: !top || top.confidence < 0.75,
        notes: vision.notes,
        disclaimerRequired: true,
      }),
    );
  });
}
