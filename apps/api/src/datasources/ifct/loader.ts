// IFCT 2017 dataset loader.
// Loads CSV into memory on first use; searches by food code or name.
// Degrades gracefully: isAvailable() returns false if dataset file is absent.
// At the Phase 3 gate, absence raises IfctDatasetMissingError (precise blocker, never faked).

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseIfctCsv, type IfctEntry } from './parser.js';
import type { CanonicalProduct, NutritionPer100g } from '../../nutrition/canonical-model.js';
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
    energyKj: null,
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

  async load(datasetDir: string): Promise<void> {
    const csvPath = join(datasetDir, 'ifct2017.csv');
    if (!existsSync(csvPath)) {
      this.loadError = new IfctDatasetMissingError(csvPath);
      return;
    }
    try {
      this.entries = await parseIfctCsv(csvPath);
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
      throw this.loadError ?? new IfctDatasetMissingError('data/ifct2017/ifct2017.csv');
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
}
