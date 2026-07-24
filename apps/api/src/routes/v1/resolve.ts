// POST /v1/resolve — barcode/name resolution endpoint.
// Runs the country-aware waterfall (resolution/country-waterfall.ts) — when
// `global.p3.unified_food_schema` is OFF (default) this is byte-identical to the plain
// cache → OFF → IFCT → USDA → not-found waterfall (country-waterfall.ts's own two functions
// delegate straight through to the legacy ones when `engineEnabled` is false, so there is
// deliberately no if/else here — always call the country-aware entry point and let it decide).
// When ON, `request.country` (decorated by country/plugin.ts on every request) additionally
// routes GB → CoFID first and IN → IFCT first before falling through to OFF/USDA.
// Auth optional: authenticated users get their userId attached to curation queue entries.

import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { resolveBarcode, resolveByName } from '../../resolution/country-waterfall.js';
import { enqueueProductEmbedding } from '../../embeddings/product-pipeline.js';
import { getBoss } from '../../jobs/boss.js';
import { recordEventBestEffort } from '../../memory/events.js';
import { buildNutritionCitation } from '../../nutrition/citation.js';
import { evaluateDiseaseRules, type DiseaseRuleEvaluation } from '../../engines/disease/index.js';
import { computeHealthScore, type HealthScoreResult } from '../../engines/score/engine.js';
import { detectAllergens } from '../../engines/allergen/detector.js';
import { allergenFailSafe } from '../../engines/allergen/fail-safe.js';
import type { AllergenId } from '../../engines/allergen/taxonomy.js';
import type { CanonicalProduct } from '../../nutrition/canonical-model.js';
import { ok, err } from '@nutrimind/shared';

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
export function _resetUnifiedFoodSchemaFlagCache(): void {
  _flagEnabled = false;
  _cacheExpiry = 0;
}

export interface ProfileSlice {
  conditions: string[];
  medications: string[];
  reproductiveStatus: string | null;
  allergens: AllergenId[];
}

/** One shared profile fetch for every per-user personalization below (disease guidance +
 *  allergen matching) — avoids a second Supabase round-trip on the scan-result hot path.
 *  Best-effort by design: a profile-fetch failure must never break product resolution. */
async function fetchProfileSlice(
  supabase: SupabaseClient,
  userId: string | undefined,
): Promise<ProfileSlice | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from('users_profiles')
      .select('conditions, medications, reproductive_status, allergens')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return null;
    return {
      conditions: (data.conditions as string[] | null) ?? [],
      medications: (data.medications as string[] | null) ?? [],
      reproductiveStatus: (data.reproductive_status as string | null) ?? null,
      allergens: (data.allergens as AllergenId[] | null) ?? [],
    };
  } catch {
    return null;
  }
}

/** Disease-aware guidance for a resolved product (10-condition expansion, audit 2026-07).
 *  Authenticated callers only — anonymous resolves return null (no conditions to evaluate). */
export function buildDiseaseGuidance(
  profile: ProfileSlice | null,
  product: CanonicalProduct | null,
): DiseaseRuleEvaluation[] | null {
  if (!profile || !product?.nutrition) return null;
  if (profile.conditions.length === 0 && !profile.reproductiveStatus) return null;
  return evaluateDiseaseRules({
    nutrition: product.nutrition,
    ingredientsText: product.ingredientsRawText,
    conditions: profile.conditions,
    medications: profile.medications,
    reproductiveStatus: profile.reproductiveStatus,
  });
}

/** Real deterministic Health Score (engines/score/engine.ts) — null only when the product has
 *  no nutrition data at all to score. */
export function buildHealthScore(product: CanonicalProduct | null): HealthScoreResult | null {
  const n = product?.nutrition;
  if (!n) return null;
  const ingredientNames = product?.ingredientsRawText ? [product.ingredientsRawText] : [];
  return computeHealthScore({
    sodiumMg: n.sodiumMg,
    sugarsG: n.sugarsG,
    sugarsAddedG: n.sugarsAddedG,
    sugarsAddedEstimated: n.sugarsAddedEstimated,
    fatSaturatedG: n.fatSaturatedG,
    fatTransG: n.fatTransG,
    dietaryFiberG: n.dietaryFiberG,
    proteinG: n.proteinG,
    novaGroup: n.novaGroup,
    ingredientNames,
  });
}

export interface ProductSafety {
  allergenMatches: ReturnType<typeof detectAllergens>['matches'];
  childWarnings: never[];
  hasFailSafe: boolean;
  failSafeReason: string | null;
}

/** Allergen Hard Gate (engines/allergen/detector.ts + fail-safe.ts) — matched against the
 *  signed-in user's own declared allergens, or every taxonomy allergen for an anonymous caller
 *  (detectAllergens' own designed fallback — the safer default, not a gap). `ingredientsRawText`
 *  here is structured DB text (OFF/IFCT/USDA), never an OCR extraction, so `ocrConfidence`/
 *  `parseQuality` are left at their "known-clean text" defaults (1.0/'high') per the same
 *  convention already documented in agents/tools/allergen.ts — the fail-safe is for label-OCR
 *  uncertainty, which doesn't apply to a barcode-resolved structured product.
 *  `childWarnings` is deliberately always empty here: child safety is inherently scoped to a
 *  specific family member's age (engines/child-safety/engine.ts), which only has meaning in the
 *  Household/Family Guardian flow, not a single generic product resolve. */
export function buildSafety(profile: ProfileSlice | null, product: CanonicalProduct | null): ProductSafety | null {
  if (!product) return null;
  const ingredientNames = product.ingredientsRawText ? [product.ingredientsRawText] : [];
  const rawLabelText = product.ingredientsRawText ?? '';
  const profileAllergens = profile?.allergens ?? [];
  const detection = detectAllergens(ingredientNames, rawLabelText, profileAllergens);
  const failSafe = allergenFailSafe(1.0, 'high', profileAllergens);
  return {
    allergenMatches: detection.matches,
    childWarnings: [],
    hasFailSafe: failSafe.triggered,
    failSafeReason: failSafe.reason,
  };
}

const BarcodeBodySchema = z.object({
  barcode: z.string().min(6).max(30).regex(/^[\d\-]+$/, 'barcode must contain only digits'),
});

const NameBodySchema = z.object({
  name: z.string().min(1).max(200),
});

export default async function resolveRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /v1/resolve/barcode
  fastify.post<{ Body: unknown }>('/resolve/barcode', async (request, reply) => {
    const body = BarcodeBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    const { barcode } = body.data;
    const userId = (request as { user?: { id?: string } }).user?.id;
    const engineEnabled = await isUnifiedFoodSchemaEnabled(fastify.supabase);

    const result = await resolveBarcode(
      barcode,
      request.country,
      {
        sql: fastify.sql,
        offClient: fastify.offClient,
        ifct: fastify.ifct,
        usdaClient: fastify.usdaClient,
        cofid: fastify.cofid,
        edgeCache: fastify.productCache,
      },
      { userId, persistResult: true, engineEnabled },
    );

    // Enqueue embedding if we just persisted a new product
    if (result.productId && result.resolvedBy !== 'cache') {
      try {
        const boss = await getBoss();
        await enqueueProductEmbedding(boss, result.productId);
      } catch {
        // Embedding is best-effort; don't fail the request
      }
    }

    if (result.resolvedBy === 'not_found') {
      return reply.status(404).send(
        ok({
          found: false,
          curationQueueId: result.curationQueueId,
          message: 'Product not found. A curation entry has been created.',
        }),
      );
    }

    // Phase 11 (AI Memory System, Layer 1) — best-effort, never blocks the response.
    if (userId) {
      recordEventBestEffort(fastify.supabase, userId, 'barcode_scanned', {
        barcode,
        resolvedBy: result.resolvedBy,
        productId: result.productId,
      });
    }

    // Real source citation (ADR-0033 addendum §B) — null only when the product has no nutrition
    // data at all; never a placeholder attribution.
    const citation = result.product ? await buildNutritionCitation(fastify.sql, result.product) : null;

    const profile = await fetchProfileSlice(fastify.supabase, userId);
    const diseaseGuidance = buildDiseaseGuidance(profile, result.product);
    const healthScore = buildHealthScore(result.product);
    const safety = buildSafety(profile, result.product);

    return reply.send(
      ok({
        found: true,
        resolvedBy: result.resolvedBy,
        product: result.product,
        citation,
        diseaseGuidance,
        healthScore,
        safety,
      }),
    );
  });

  // POST /v1/resolve/name
  fastify.post<{ Body: unknown }>('/resolve/name', async (request, reply) => {
    const body = NameBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    const { name } = body.data;
    const engineEnabled = await isUnifiedFoodSchemaEnabled(fastify.supabase);

    const result = await resolveByName(name, request.country, {
      sql: fastify.sql,
      offClient: fastify.offClient,
      ifct: fastify.ifct,
      usdaClient: fastify.usdaClient,
      cofid: fastify.cofid,
    }, { engineEnabled });

    if (result.resolvedBy === 'not_found') {
      return reply.status(404).send(ok({ found: false, message: 'No matching food found.' }));
    }

    const citation = result.product ? await buildNutritionCitation(fastify.sql, result.product) : null;

    const nameUserId = (request as { user?: { id?: string } }).user?.id;
    const nameProfile = await fetchProfileSlice(fastify.supabase, nameUserId);
    const diseaseGuidance = buildDiseaseGuidance(nameProfile, result.product);
    const healthScore = buildHealthScore(result.product);
    const safety = buildSafety(nameProfile, result.product);

    return reply.send(ok({
      found: true,
      resolvedBy: result.resolvedBy,
      product: result.product,
      citation,
      diseaseGuidance,
      healthScore,
      safety,
    }));
  });
}
