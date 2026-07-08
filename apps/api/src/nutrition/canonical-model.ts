// Cross-cutting invariant: every nutrition row carries NOT NULL provenance (source, sourceId,
// datasetVersion, retrievedAt, licenseClass). Schema-enforced in product_nutrition table.

export interface Provenance {
  source: string;         // references data_sources.id
  sourceId: string;       // external identifier (barcode, FDC ID, IFCT code, etc.)
  datasetVersion: string; // 'live' for live APIs; '2017' for IFCT
  retrievedAt: Date;
  licenseClass: string;   // matches data_sources.license_class CHECK constraint
}

// All nutrient values are per 100 g (or per 100 ml for liquids).
export interface NutritionPer100g extends Provenance {
  energyKcal: number | null;
  energyKj: number | null;
  proteinG: number | null;
  fatTotalG: number | null;
  fatSaturatedG: number | null;
  fatTransG: number | null;
  fatPolyunsaturatedG: number | null;
  fatMonounsaturatedG: number | null;
  carbohydratesG: number | null;
  sugarsG: number | null;
  sugarsAddedG: number | null;
  sugarsAddedEstimated: boolean;  // true when estimated per ADR-0007, not directly labeled
  dietaryFiberG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  potassiumMg: number | null;
  zincMg: number | null;
  vitaminCMg: number | null;
  vitaminAIu: number | null;
  vitaminDIu: number | null;
  vitaminB12Mcg: number | null;
  folateMcg: number | null;
  novaGroup: 1 | 2 | 3 | 4 | null;
  confidence: number | null;  // 0–1; null if not assessed
  notes: string | null;       // energy consistency warnings, estimation notes, etc.
}

export interface CanonicalProduct extends Provenance {
  id?: string;  // DB uuid, present only after persistence
  barcode: string | null;
  barcodeType: 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'qr' | 'other' | null;
  name: string;
  brand: string | null;
  category: string | null;
  subCategory: string | null;
  countryOfOrigin: string | null;
  servingSizeG: number | null;
  servingDescription: string | null;
  packageSizeG: number | null;
  fssaiVegMark: 'green' | 'red' | 'unknown' | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  nutrition: NutritionPer100g | null;
  ingredientsRawText: string | null;
  // Phase 3 — Unified Global Food Database (optional, backward compat)
  countryCodes?: string[];      // ISO-3166 codes where this product is known to be sold
  sourceRegion?: string | null; // ISO code of the data source's primary region (e.g. 'GB' for CoFID)
}
