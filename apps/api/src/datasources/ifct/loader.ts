// IFCT 2017 dataset loader.
// Loads the real book-derived data into memory on first use; searches by food code or name.
// Degrades gracefully: isAvailable() returns false if the dataset file is absent.
// At the Phase 3 gate, absence raises IfctDatasetMissingError (precise blocker, never faked).
//
// ADR-0031: the real dataset is the ICMR-NIN book (PDF), not the placeholder CSV this file
// originally expected (that format was never actually delivered). The loader's own public
// contract — isAvailable(), findByCode(), searchByName(), toCanonicalProduct(), getAll(), count —
// is unchanged; every real call site (resolution/waterfall.ts, packs/sync-service.ts,
// agents/tools/*) keeps working exactly as before. What changed internally: `load()` now reads
// the real extracted-and-parsed Table 1 (Proximates) data; further tables are added incrementally
// (ADR-0031 §5) without changing this class's public surface again.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTable1 } from './book-parser.js';
import { validateTable1 } from './validate-table1.js';
import { table1RowToEntry, buildTable1ImportReport, type IfctEntry, type Table1ImportReport } from './parser.js';
import type { CanonicalProduct, NutritionPer100g, NutrientValueState } from '../../nutrition/canonical-model.js';
import { estimateAddedSugar, energyConsistencyNote, fillEnergyFields } from '../../nutrition/derived.js';

export class IfctDatasetMissingError extends Error {
  constructor(expectedPath: string) {
    super(
      `IFCT 2017 dataset not found at: ${expectedPath}\n` +
      `Obtain the ICMR-NIN IFCT 2017 data file and place it at that path.\n` +
      `Acquisition: https://www.nin.res.in — see docs/DATA_SOURCES.md (Risk R-01).`,
    );
    this.name = 'IfctDatasetMissingError';
  }
}

// Beta-carotene (mcg) → Vitamin A IU.
// Provitamin A bioactivity: 1 mcg beta-carotene = 1/6 mcg RAE = 0.556 IU.
function betaCaroteneToVitaminAIu(mcg: number): number {
  return mcg * (1 / 6) * 3.333;
}

export function entryToNutrition(entry: IfctEntry): NutritionPer100g {
  const now = new Date();
  const prov = {
    source: 'ifct_2017',
    sourceId: entry.foodCode,
    datasetVersion: '2017',
    retrievedAt: now,
    licenseClass: 'licensed_restricted',
  };

  const { sugarsAddedG, sugarsAddedEstimated } = estimateAddedSugar(undefined, entry.sugarsG);
  const note = energyConsistencyNote(
    entry.energyKcal,
    entry.proteinG,
    entry.fatTotalG,
    entry.carbohydratesG,
  );

  const nutrition: NutritionPer100g = {
    ...prov,
    energyKcal: entry.energyKcal,
    energyKj: entry.energyKj,
    proteinG: entry.proteinG,
    fatTotalG: entry.fatTotalG,
    fatSaturatedG: null,
    fatTransG: null,
    fatPolyunsaturatedG: null,
    fatMonounsaturatedG: null,
    carbohydratesG: entry.carbohydratesG,
    sugarsG: entry.sugarsG,
    sugarsAddedG,
    sugarsAddedEstimated,
    dietaryFiberG: entry.dietaryFiberG,
    sodiumMg: entry.sodiumMg,
    cholesterolMg: entry.cholesterolMg,
    calciumMg: entry.calciumMg,
    ironMg: entry.ironMg,
    potassiumMg: entry.potassiumMg,
    zincMg: entry.zincMg,
    vitaminCMg: entry.vitaminCMg,
    vitaminAIu: entry.betaCaroteneMcg !== null ? betaCaroteneToVitaminAIu(entry.betaCaroteneMcg) : null,
    vitaminDIu: null,
    vitaminB12Mcg: entry.vitaminB12Mcg,
    folateMcg: entry.folateMcg,
    novaGroup: null,
    confidence: 0.95,  // IFCT is authoritative for Indian foods
    notes: note,
    ashG: entry.ashG,
    moistureG: entry.moistureG,
    nutrientSd: Object.keys(entry.sd).length > 0 ? entry.sd : undefined,
    nutrientValueState: Object.keys(entry.valueState).length > 0
      ? (entry.valueState as Record<string, NutrientValueState>)
      : undefined,
  };

  fillEnergyFields(nutrition);
  return nutrition;
}

export function entryToCanonicalProduct(entry: IfctEntry): CanonicalProduct {
  const prov = {
    source: 'ifct_2017',
    sourceId: entry.foodCode,
    datasetVersion: '2017',
    retrievedAt: new Date(),
    licenseClass: 'licensed_restricted',
  };

  return {
    ...prov,
    barcode: null,
    barcodeType: null,
    name: entry.foodNameEn,
    brand: null,
    category: entry.foodGroup || null,
    subCategory: null,
    countryOfOrigin: 'india',
    servingSizeG: null,
    servingDescription: null,
    packageSizeG: null,
    fssaiVegMark: null,
    imageUrl: null,
    thumbnailUrl: null,
    nutrition: entryToNutrition(entry),
    ingredientsRawText: null,
  };
}

export class IfctLoader {
  private entries: IfctEntry[] = [];
  private byCode = new Map<string, IfctEntry>();
  private loaded = false;
  private loadError: Error | null = null;
  private lastImportReport: Table1ImportReport | null = null;

  async load(datasetDir: string): Promise<void> {
    // Real extracted-and-sliced Table 1 text — produced by a one-time offline step
    // (`pdftotext -raw -enc UTF-8`, then slicing to the real Table 1 boundaries) documented in
    // format.md. Kept outside the repo (gitignored), same placement convention the original
    // (never-delivered) CSV format used.
    const table1Path = join(datasetDir, 'table1_proximates_raw.txt');
    if (!existsSync(table1Path)) {
      this.loadError = new IfctDatasetMissingError(table1Path);
      return;
    }
    try {
      const rawText = readFileSync(table1Path, 'utf8');
      const parsed = parseTable1(rawText);
      const { valid, results } = validateTable1(parsed.rows);
      const entries = valid.map(table1RowToEntry);

      this.lastImportReport = buildTable1ImportReport(parsed.rejected, results, entries);
      this.entries = entries;
      for (const e of this.entries) {
        this.byCode.set(e.foodCode.toLowerCase(), e);
      }
      this.loaded = true;
    } catch (err) {
      this.loadError = err instanceof Error ? err : new Error(String(err));
    }
  }

  isAvailable(): boolean {
    return this.loaded;
  }

  // Precise blocker for the Phase 3 gate — thrown when gate test attempts IFCT lookup.
  requireAvailable(): void {
    if (!this.loaded) {
      throw this.loadError ?? new IfctDatasetMissingError('data/ifct2017/table1_proximates_raw.txt');
    }
  }

  findByCode(code: string): IfctEntry | null {
    return this.byCode.get(code.toLowerCase()) ?? null;
  }

  // Case-insensitive substring search on English name.
  searchByName(query: string, limit = 10): IfctEntry[] {
    if (!this.loaded) return [];
    const q = query.toLowerCase();
    const results: IfctEntry[] = [];
    for (const entry of this.entries) {
      if (entry.foodNameEn.toLowerCase().includes(q)) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  toCanonicalProduct(entry: IfctEntry): CanonicalProduct {
    return entryToCanonicalProduct(entry);
  }

  /** Full entry list — used by the Phase 9 regional pack sync endpoint. Returns a copy. */
  getAll(): IfctEntry[] {
    return [...this.entries];
  }

  get count(): number {
    return this.entries.length;
  }

  /** The real parse/validation report from the last load() — counts, rejections with reasons,
   *  warnings. Null until load() has run. Used by the import script (ADR-0031 §4 stage 5). */
  getImportReport(): Table1ImportReport | null {
    return this.lastImportReport;
  }
}
