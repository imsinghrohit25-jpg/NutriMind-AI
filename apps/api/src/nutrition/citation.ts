// Nutrition source-attribution citation — addendum §B ("mandatory source attribution"). Every
// nutrition number surfaced through an AI/agent-facing response must carry real, DB-verified
// provenance, never a hardcoded/guessed attribution string. Built from data that already exists
// on every resolved CanonicalProduct (source, sourceId, datasetVersion) plus a live lookup against
// `data_sources` (display name, licence, attribution text — the single source of truth already
// used by every other integration's own ADR, never duplicated here) and `import_batches` (when a
// real batch exists for this source/version — live-API sources like USDA/OFF have none, and that
// absence is reported honestly as `null`, never fabricated).

import type postgres from 'postgres';
import type { CanonicalProduct, NutritionPer100g } from './canonical-model.js';
import { gradeDataQuality } from '../agents/tools/nutrition.js';

type Sql = postgres.Sql;

export interface NutritionCitation {
  source: string;              // data_sources.id, e.g. 'cofid_2021'
  sourceDisplay: string;       // data_sources.display_name
  licenseClass: string;        // data_sources.license_class
  attributionText: string;     // data_sources.attribution_text
  termsUrl: string | null;     // data_sources.terms_url
  datasetVersion: string;      // the resolved product's own datasetVersion
  /** import_batches.id for the most recent completed batch matching this source + dataset
   *  version — null for live-API sources (USDA, OpenFoodFacts) that have no batch import, or if
   *  none is found. Never fabricated. */
  importBatchId: string | null;
  sourceFoodId: string;        // the resolved product's own sourceId
  dataQualityGrade: 'A' | 'B' | 'C' | 'D';
  /** Only nutrients the source itself explicitly flags as an estimate (NutrientValueState
   *  'estimated', e.g. CoFID's bracketed/parenthesised convention — ADR-0033 §3). Deliberately
   *  excludes 'not_analyzed'/'trace'/'not_detected' states: those are extremely common per-food
   *  (e.g. a single CoFID food routinely has a dozen not-analyzed micronutrients) and would bury
   *  the one qualifier that's actually actionable — "this specific number is an estimate, not a
   *  direct measurement" — in noise about nutrients the response likely isn't even showing. */
  valueStateNotes: string[];
}

function buildValueStateNotes(nutrition: NutritionPer100g): string[] {
  if (!nutrition.nutrientValueState) return [];
  const notes: string[] = [];
  for (const [field, state] of Object.entries(nutrition.nutrientValueState)) {
    if (state === 'estimated') notes.push(`${field} is an estimated value (flagged by the source)`);
  }
  return notes;
}

/** Builds the real citation for a resolved product, or null when the product has no nutrition
 *  data at all (nothing to attribute) or its `data_sources` row is somehow missing (should never
 *  happen for a real resolved product — never fabricated as a fallback). */
export async function buildNutritionCitation(sql: Sql, product: CanonicalProduct): Promise<NutritionCitation | null> {
  if (!product.nutrition) return null;

  const [dataSource] = await sql<{
    display_name: string;
    license_class: string;
    attribution_text: string;
    terms_url: string | null;
  }[]>`
    SELECT display_name, license_class, attribution_text, terms_url
    FROM public.data_sources
    WHERE id = ${product.source}
  `;
  if (!dataSource) return null;

  const [batch] = await sql<{ id: string }[]>`
    SELECT id FROM public.import_batches
    WHERE source = ${product.source} AND dataset_version = ${product.datasetVersion} AND status = 'completed'
    ORDER BY started_at DESC
    LIMIT 1
  `;

  return {
    source: product.source,
    sourceDisplay: dataSource.display_name,
    licenseClass: dataSource.license_class,
    attributionText: dataSource.attribution_text,
    termsUrl: dataSource.terms_url,
    datasetVersion: product.datasetVersion,
    importBatchId: batch?.id ?? null,
    sourceFoodId: product.sourceId,
    dataQualityGrade: gradeDataQuality(product.nutrition),
    valueStateNotes: buildValueStateNotes(product.nutrition),
  };
}
