// Persistence for CNF's real, additive data (portions + aliases) — ADR-0032. Reuses the existing
// `persistProduct` (openfoodfacts/cache.ts) UNCHANGED for the product + product_nutrition rows —
// CNF's (source, source_id) pair ('cnf_2026', Food_Code) can never collide with any existing
// USDA/IFCT row (different `source` value), so the existing upsert-by-(source,source_id) contract
// is exactly right, reused as-is.
//
// CNF foods are deliberately NEVER auto-linked or merged into an existing USDA/IFCT canonical
// identity (ADR-0032, following the master prompt's own §5 guidance: "a false split is safe; a
// false merge corrupts data" — no confidence-scored matching was specified precisely enough to
// implement safely in this pass, so every CNF food becomes its own independent product row, never
// merged). This is a deliberate, documented scope boundary, not an oversight.

import type postgres from 'postgres';
import type { CnfPortionRecord, CnfAliasRecord } from './normalize.js';
import { CNF_SOURCE_ID } from './normalize.js';

type Sql = postgres.Sql;

export async function persistCnfPortions(sql: Sql, productId: string, portions: CnfPortionRecord[]): Promise<void> {
  for (const p of portions) {
    await sql`
      INSERT INTO public.product_portions (
        product_id, measure_type, description_en, description_fr, value, value_unit, source, source_measure_id
      ) VALUES (
        ${productId}, ${p.measureType}, ${p.descriptionEn}, ${p.descriptionFr}, ${p.value}, ${p.valueUnit}, ${CNF_SOURCE_ID}, ${p.sourceMeasureId}
      )
      ON CONFLICT (product_id, measure_type, description_en) DO UPDATE SET
        value = EXCLUDED.value,
        value_unit = EXCLUDED.value_unit
    `;
  }
}

export async function persistCnfAliases(sql: Sql, productId: string, aliases: CnfAliasRecord[]): Promise<void> {
  for (const a of aliases) {
    await sql`
      INSERT INTO public.product_aliases (
        product_id, language_code, alias_name, alias_type, source
      ) VALUES (
        ${productId}, ${a.languageCode}, ${a.aliasName}, ${a.aliasType}, ${CNF_SOURCE_ID}
      )
      ON CONFLICT (product_id, language_code, alias_type, alias_name) DO NOTHING
    `;
  }
}
