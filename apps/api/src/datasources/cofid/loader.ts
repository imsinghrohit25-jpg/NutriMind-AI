// CoFID (UK Composition of Foods Integrated Dataset) runtime loader.
// CoFID is published by Public Health England (PHE) / OHID. Offline dataset; not a live API.
//
// ADR-0033: the real dataset is the official CoFID 2021 Excel workbook (McCance and Widdowson's),
// not the placeholder flat-JSON format this file originally expected (`data/cofid/cofid.json`,
// never actually delivered — the real distribution is a 14-sheet workbook, not a flat table). This
// class's own public contract — isAvailable(), getByCode(), searchByName(), toCanonicalProduct(),
// getAll(), size — is UNCHANGED; every real call site (resolution/country-waterfall.ts,
// packs/sync-service.ts) keeps working exactly as before, same discipline ADR-0031 established when
// IfctLoader's internals were swapped from a placeholder to the real book data.

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CanonicalProduct } from '../../nutrition/canonical-model.js';
import { loadCofidDataset, findMissingCofidFile } from './xlsx-loader.js';
import { validateCofidDataset, type CofidValidationResult } from './validate.js';
import { normalizeCofidFood } from './normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COFID_PATH = join(__dirname, '../../../data/cofid/cofid_2021.xlsx');

export class CofidLoader {
  private _products: CanonicalProduct[] = [];
  private _byCode = new Map<string, CanonicalProduct>();
  private _available = false;
  private _lastValidation: CofidValidationResult | null = null;

  async load(filePath: string = COFID_PATH): Promise<void> {
    const missing = findMissingCofidFile(filePath);
    if (missing) {
      console.info('[cofid] Dataset not found at', missing, '— CoFID resolution disabled');
      return;
    }
    try {
      const dataset = await loadCofidDataset(filePath);
      const validation = validateCofidDataset(dataset);
      this._lastValidation = validation;

      // A duplicate Food Code (real, in the official 2021 workbook — see import-cofid.ts's own
      // comment) is only rejected at the CODE level by validate.ts; skip already-processed codes
      // here too so the FIRST occurrence wins, not whichever row happens to be scanned last.
      const products: CanonicalProduct[] = [];
      const processedCodes = new Set<string>();
      for (const food of dataset.foods) {
        if (!validation.validFoodCodes.has(food.foodCode)) continue;
        if (processedCodes.has(food.foodCode)) continue;
        processedCodes.add(food.foodCode);
        products.push(normalizeCofidFood(food, dataset));
      }
      this._products = products;
      for (const p of products) this._byCode.set(p.sourceId.toLowerCase(), p);
      this._available = true;
      console.info('[cofid] Loaded', this._products.length, 'foods (', validation.rejections.length, 'rejected,', validation.warnings.length, 'warnings)');
    } catch (err) {
      console.warn('[cofid] Failed to load dataset:', err instanceof Error ? err.message : err);
    }
  }

  isAvailable(): boolean {
    return this._available;
  }

  searchByName(name: string, maxResults = 5): CanonicalProduct[] {
    if (!this._available) return [];
    const q = name.toLowerCase().trim();
    return this._products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, maxResults);
  }

  getByCode(code: string): CanonicalProduct | null {
    return this._byCode.get(code.toLowerCase()) ?? null;
  }

  toCanonicalProduct(product: CanonicalProduct): CanonicalProduct {
    return product;
  }

  get size(): number {
    return this._products.length;
  }

  /** Full food list — used by the Phase 9 regional pack sync endpoint. Returns a copy. */
  getAll(): CanonicalProduct[] {
    return [...this._products];
  }

  /** The real validation report from the last load() — counts, rejections with reasons, warnings,
   *  symbol tally. Null until load() has run. Used by the import script (ADR-0033 §4). */
  getValidationResult(): CofidValidationResult | null {
    return this._lastValidation;
  }
}

export { COFID_PATH };
export const cofidFileExists = (): boolean => existsSync(COFID_PATH);
