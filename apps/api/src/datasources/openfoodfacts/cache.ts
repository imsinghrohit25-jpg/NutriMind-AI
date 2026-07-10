// DB-backed cache for OpenFoodFacts products.
// Implements the OFF etiquette mandate: every fetched product persists with retrieved_at
// so the second lookup never re-hits OFF servers (cache-first discipline).

import type postgres from 'postgres';
import type { CanonicalProduct, NutritionPer100g, NutrientValueState } from '../../nutrition/canonical-model.js';

type Sql = postgres.Sql;

interface ProductRow {
  id: string;
  barcode: string | null;
  barcode_type: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  sub_category: string | null;
  country_of_origin: string | null;
  serving_size_g: string | null;
  serving_description: string | null;
  package_size_g: string | null;
  fssai_veg_mark: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  source: string;
  source_id: string;
  dataset_version: string;
  retrieved_at: Date;
  license_class: string;
}

export interface NutritionRow {
  energy_kcal: string | null;
  energy_kj: string | null;
  protein_g: string | null;
  fat_total_g: string | null;
  fat_saturated_g: string | null;
  fat_trans_g: string | null;
  fat_polyunsaturated_g: string | null;
  fat_monounsaturated_g: string | null;
  carbohydrates_g: string | null;
  sugars_g: string | null;
  sugars_added_g: string | null;
  sugars_added_estimated: boolean;
  dietary_fiber_g: string | null;
  sodium_mg: string | null;
  cholesterol_mg: string | null;
  calcium_mg: string | null;
  iron_mg: string | null;
  potassium_mg: string | null;
  zinc_mg: string | null;
  vitamin_c_mg: string | null;
  vitamin_a_iu: string | null;
  vitamin_d_iu: string | null;
  vitamin_b12_mcg: string | null;
  folate_mcg: string | null;
  nova_group: number | null;
  confidence: string | null;
  notes: string | null;
  ash_g: string | null;
  moisture_g: string | null;
  nutrient_sd: Record<string, number> | null;
  nutrient_value_state: Record<string, string> | null;
  nutrient_extra: Record<string, number> | null;
  source: string;
  source_id: string;
  dataset_version: string;
  retrieved_at: Date;
  license_class: string;
}

// `row.<field>` is `string | null` as returned by postgres.js for a NUMERIC column. The null check
// must happen BEFORE any numeric conversion — `Number(null) === 0` in JS, so a caller that wrote
// `pg(Number(row.field))` would silently convert a genuinely-NULL nutrient into a false zero on
// every read (found while building ADR-0031 Table 2's merge-import: the first real code path to
// read a row back and write it out again, which is when this corruption became observable).
function pg(v: string | number | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

export function rowToNutrition(row: NutritionRow): NutritionPer100g {
  const novaRaw = row.nova_group;
  return {
    source: row.source,
    sourceId: row.source_id,
    datasetVersion: row.dataset_version,
    retrievedAt: row.retrieved_at,
    licenseClass: row.license_class,
    energyKcal: pg(row.energy_kcal),
    energyKj: pg(row.energy_kj),
    proteinG: pg(row.protein_g),
    fatTotalG: pg(row.fat_total_g),
    fatSaturatedG: pg(row.fat_saturated_g),
    fatTransG: pg(row.fat_trans_g),
    fatPolyunsaturatedG: pg(row.fat_polyunsaturated_g),
    fatMonounsaturatedG: pg(row.fat_monounsaturated_g),
    carbohydratesG: pg(row.carbohydrates_g),
    sugarsG: pg(row.sugars_g),
    sugarsAddedG: pg(row.sugars_added_g),
    sugarsAddedEstimated: row.sugars_added_estimated,
    dietaryFiberG: pg(row.dietary_fiber_g),
    sodiumMg: pg(row.sodium_mg),
    cholesterolMg: pg(row.cholesterol_mg),
    calciumMg: pg(row.calcium_mg),
    ironMg: pg(row.iron_mg),
    potassiumMg: pg(row.potassium_mg),
    zincMg: pg(row.zinc_mg),
    vitaminCMg: pg(row.vitamin_c_mg),
    vitaminAIu: pg(row.vitamin_a_iu),
    vitaminDIu: pg(row.vitamin_d_iu),
    vitaminB12Mcg: pg(row.vitamin_b12_mcg),
    folateMcg: pg(row.folate_mcg),
    novaGroup: novaRaw === 1 || novaRaw === 2 || novaRaw === 3 || novaRaw === 4 ? novaRaw : null,
    confidence: pg(row.confidence),
    notes: row.notes,
    ashG: pg(row.ash_g),
    moistureG: pg(row.moisture_g),
    nutrientSd: row.nutrient_sd ?? undefined,
    nutrientValueState: (row.nutrient_value_state as Record<string, NutrientValueState> | null) ?? undefined,
    nutrientExtra: row.nutrient_extra ?? undefined,
  };
}

export async function getProductFromCache(
  sql: Sql,
  barcode: string,
  ttlHours: number,
): Promise<CanonicalProduct | null> {
  const rows = await sql<ProductRow[]>`
    SELECT p.*
    FROM public.products p
    WHERE p.barcode = ${barcode}
      AND p.retrieved_at > NOW() - (${ttlHours} * INTERVAL '1 hour')
    LIMIT 1
  `;
  if (!rows.length) return null;
  const p = rows[0]!;

  const nutritionRows = await sql<NutritionRow[]>`
    SELECT pn.*, p.source, p.source_id, p.dataset_version, p.retrieved_at, p.license_class
    FROM public.product_nutrition pn
    JOIN public.products p ON p.id = pn.product_id
    WHERE pn.product_id = ${p.id}
    LIMIT 1
  `;

  const ingredientsRows = await sql<{ raw_text: string }[]>`
    SELECT raw_text FROM public.product_ingredients WHERE product_id = ${p.id} LIMIT 1
  `;

  const novaRaw = null;
  return {
    id: p.id,
    barcode: p.barcode,
    barcodeType: (p.barcode_type as CanonicalProduct['barcodeType']) ?? null,
    name: p.name,
    brand: p.brand,
    category: p.category,
    subCategory: p.sub_category,
    countryOfOrigin: p.country_of_origin,
    servingSizeG: p.serving_size_g ? Number(p.serving_size_g) : null,
    servingDescription: p.serving_description,
    packageSizeG: p.package_size_g ? Number(p.package_size_g) : null,
    fssaiVegMark: (p.fssai_veg_mark as CanonicalProduct['fssaiVegMark']) ?? null,
    imageUrl: p.image_url,
    thumbnailUrl: p.thumbnail_url,
    source: p.source,
    sourceId: p.source_id,
    datasetVersion: p.dataset_version,
    retrievedAt: p.retrieved_at,
    licenseClass: p.license_class,
    nutrition: nutritionRows.length ? rowToNutrition(nutritionRows[0]!) : null,
    ingredientsRawText: ingredientsRows[0]?.raw_text ?? null,
  };
  void novaRaw;
}

/** Looks up an already-persisted product by its own (source, source_id) key — used by table
 *  merge scripts (ADR-0031 §5) that need to fold a later table's nutrients into a row an earlier
 *  table's import already inserted, rather than re-fetching by barcode (IFCT rows have none) or
 *  overwriting fields the current table doesn't cover. Unlike `getProductFromCache`, there is no
 *  TTL check — a licensed static dataset row never "expires" the way a live API fetch does. */
export async function getProductBySourceId(
  sql: Sql,
  source: string,
  sourceId: string,
): Promise<CanonicalProduct | null> {
  const rows = await sql<ProductRow[]>`
    SELECT p.* FROM public.products p
    WHERE p.source = ${source} AND p.source_id = ${sourceId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const p = rows[0]!;

  const nutritionRows = await sql<NutritionRow[]>`
    SELECT pn.*, p.source, p.source_id, p.dataset_version, p.retrieved_at, p.license_class
    FROM public.product_nutrition pn
    JOIN public.products p ON p.id = pn.product_id
    WHERE pn.product_id = ${p.id}
    LIMIT 1
  `;

  const ingredientsRows = await sql<{ raw_text: string }[]>`
    SELECT raw_text FROM public.product_ingredients WHERE product_id = ${p.id} LIMIT 1
  `;

  return {
    id: p.id,
    barcode: p.barcode,
    barcodeType: (p.barcode_type as CanonicalProduct['barcodeType']) ?? null,
    name: p.name,
    brand: p.brand,
    category: p.category,
    subCategory: p.sub_category,
    countryOfOrigin: p.country_of_origin,
    servingSizeG: p.serving_size_g ? Number(p.serving_size_g) : null,
    servingDescription: p.serving_description,
    packageSizeG: p.package_size_g ? Number(p.package_size_g) : null,
    fssaiVegMark: (p.fssai_veg_mark as CanonicalProduct['fssaiVegMark']) ?? null,
    imageUrl: p.image_url,
    thumbnailUrl: p.thumbnail_url,
    source: p.source,
    sourceId: p.source_id,
    datasetVersion: p.dataset_version,
    retrievedAt: p.retrieved_at,
    licenseClass: p.license_class,
    nutrition: nutritionRows.length ? rowToNutrition(nutritionRows[0]!) : null,
    ingredientsRawText: ingredientsRows[0]?.raw_text ?? null,
  };
}

export async function persistProduct(sql: Sql, product: CanonicalProduct): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO public.products (
      barcode, barcode_type, name, brand, category, sub_category,
      country_of_origin, serving_size_g, serving_description, package_size_g,
      fssai_veg_mark, image_url, thumbnail_url,
      source, source_id, dataset_version, retrieved_at, license_class
    ) VALUES (
      ${product.barcode}, ${product.barcodeType}, ${product.name}, ${product.brand},
      ${product.category}, ${product.subCategory}, ${product.countryOfOrigin},
      ${product.servingSizeG}, ${product.servingDescription}, ${product.packageSizeG},
      ${product.fssaiVegMark}, ${product.imageUrl}, ${product.thumbnailUrl},
      ${product.source}, ${product.sourceId}, ${product.datasetVersion},
      ${product.retrievedAt}, ${product.licenseClass}
    )
    ON CONFLICT (source, source_id) DO UPDATE SET
      barcode          = EXCLUDED.barcode,
      name             = EXCLUDED.name,
      brand            = EXCLUDED.brand,
      image_url        = EXCLUDED.image_url,
      retrieved_at     = EXCLUDED.retrieved_at,
      updated_at       = NOW()
    RETURNING id
  `;
  const productId = rows[0]!.id;

  if (product.nutrition) {
    const nut = product.nutrition;
    await sql`
      INSERT INTO public.product_nutrition (
        product_id,
        energy_kcal, energy_kj,
        protein_g, fat_total_g, fat_saturated_g, fat_trans_g,
        fat_polyunsaturated_g, fat_monounsaturated_g,
        carbohydrates_g, sugars_g, sugars_added_g, sugars_added_estimated,
        dietary_fiber_g, sodium_mg, cholesterol_mg,
        calcium_mg, iron_mg, potassium_mg, zinc_mg,
        vitamin_c_mg, vitamin_a_iu, vitamin_d_iu, vitamin_b12_mcg, folate_mcg,
        nova_group, confidence, notes,
        ash_g, moisture_g, nutrient_sd, nutrient_value_state, nutrient_extra,
        source, source_id, dataset_version, retrieved_at, license_class
      ) VALUES (
        ${productId},
        ${nut.energyKcal}, ${nut.energyKj},
        ${nut.proteinG}, ${nut.fatTotalG}, ${nut.fatSaturatedG}, ${nut.fatTransG},
        ${nut.fatPolyunsaturatedG}, ${nut.fatMonounsaturatedG},
        ${nut.carbohydratesG}, ${nut.sugarsG}, ${nut.sugarsAddedG}, ${nut.sugarsAddedEstimated},
        ${nut.dietaryFiberG}, ${nut.sodiumMg}, ${nut.cholesterolMg},
        ${nut.calciumMg}, ${nut.ironMg}, ${nut.potassiumMg}, ${nut.zincMg},
        ${nut.vitaminCMg}, ${nut.vitaminAIu}, ${nut.vitaminDIu}, ${nut.vitaminB12Mcg}, ${nut.folateMcg},
        ${nut.novaGroup}, ${nut.confidence}, ${nut.notes},
        ${nut.ashG}, ${nut.moistureG},
        ${nut.nutrientSd ? sql.json(nut.nutrientSd) : null},
        ${nut.nutrientValueState ? sql.json(nut.nutrientValueState) : null},
        ${nut.nutrientExtra ? sql.json(nut.nutrientExtra) : null},
        ${nut.source}, ${nut.sourceId}, ${nut.datasetVersion}, ${nut.retrievedAt}, ${nut.licenseClass}
      )
      ON CONFLICT (product_id) DO UPDATE SET
        energy_kcal            = EXCLUDED.energy_kcal,
        energy_kj              = EXCLUDED.energy_kj,
        protein_g              = EXCLUDED.protein_g,
        fat_total_g            = EXCLUDED.fat_total_g,
        fat_saturated_g        = EXCLUDED.fat_saturated_g,
        fat_trans_g            = EXCLUDED.fat_trans_g,
        fat_polyunsaturated_g  = EXCLUDED.fat_polyunsaturated_g,
        fat_monounsaturated_g  = EXCLUDED.fat_monounsaturated_g,
        carbohydrates_g        = EXCLUDED.carbohydrates_g,
        sugars_g               = EXCLUDED.sugars_g,
        sugars_added_g         = EXCLUDED.sugars_added_g,
        sugars_added_estimated = EXCLUDED.sugars_added_estimated,
        dietary_fiber_g        = EXCLUDED.dietary_fiber_g,
        sodium_mg              = EXCLUDED.sodium_mg,
        cholesterol_mg         = EXCLUDED.cholesterol_mg,
        calcium_mg             = EXCLUDED.calcium_mg,
        iron_mg                = EXCLUDED.iron_mg,
        potassium_mg           = EXCLUDED.potassium_mg,
        zinc_mg                = EXCLUDED.zinc_mg,
        vitamin_c_mg           = EXCLUDED.vitamin_c_mg,
        vitamin_a_iu           = EXCLUDED.vitamin_a_iu,
        vitamin_d_iu           = EXCLUDED.vitamin_d_iu,
        vitamin_b12_mcg        = EXCLUDED.vitamin_b12_mcg,
        folate_mcg             = EXCLUDED.folate_mcg,
        nova_group             = EXCLUDED.nova_group,
        confidence             = EXCLUDED.confidence,
        notes                  = EXCLUDED.notes,
        ash_g                  = EXCLUDED.ash_g,
        moisture_g             = EXCLUDED.moisture_g,
        nutrient_sd            = EXCLUDED.nutrient_sd,
        nutrient_value_state   = EXCLUDED.nutrient_value_state,
        nutrient_extra         = EXCLUDED.nutrient_extra,
        retrieved_at           = EXCLUDED.retrieved_at,
        updated_at             = NOW()
    `;
  }

  if (product.ingredientsRawText) {
    await sql`
      INSERT INTO public.product_ingredients (
        product_id, raw_text,
        source, source_id, dataset_version, retrieved_at, license_class
      ) VALUES (
        ${productId}, ${product.ingredientsRawText},
        ${product.source}, ${product.sourceId}, ${product.datasetVersion},
        ${product.retrievedAt}, ${product.licenseClass}
      )
      ON CONFLICT (product_id) DO UPDATE SET
        raw_text     = EXCLUDED.raw_text,
        retrieved_at = EXCLUDED.retrieved_at
    `;
  }

  return productId;
}
