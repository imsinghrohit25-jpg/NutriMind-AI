// CoFID (UK Composition of Foods Integrated Dataset) loader.
// CoFID is published by Public Health England (PHE) / UK FSA.
// Offline dataset; not a live API. Loaded from apps/api/data/cofid/cofid.json
// when the file is present. Gracefully degrades when absent (like IFCT pattern).

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CanonicalProduct } from '../../nutrition/canonical-model.js';
import { normalizeCofidFood } from './normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COFID_PATH = resolve(__dirname, '../../../data/cofid/cofid.json');

export interface CofidFood {
  food_code: string;
  food_name: string;
  food_group: string;
  energy_kcal: number | null;
  energy_kj: number | null;
  protein_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  carbohydrate_g: number | null;
  total_sugars_g: number | null;
  dietary_fibre_g: number | null;
  sodium_mg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  potassium_mg: number | null;
  zinc_mg: number | null;
  vitamin_c_mg: number | null;
  vitamin_a_ug: number | null;  // μg RAE
  vitamin_d_ug: number | null;  // μg
  vitamin_b12_ug: number | null;
  folate_ug: number | null;
}

export class CofidLoader {
  private _foods: CofidFood[] | null = null;
  private _available = false;

  async load(): Promise<void> {
    if (!existsSync(COFID_PATH)) {
      console.info('[cofid] Dataset not found at', COFID_PATH, '— CoFID resolution disabled');
      return;
    }
    try {
      const raw = await readFile(COFID_PATH, 'utf-8');
      this._foods = JSON.parse(raw) as CofidFood[];
      this._available = true;
      console.info('[cofid] Loaded', this._foods.length, 'food items');
    } catch (err) {
      console.warn('[cofid] Failed to load dataset:', err instanceof Error ? err.message : err);
    }
  }

  isAvailable(): boolean {
    return this._available && this._foods !== null;
  }

  searchByName(name: string, maxResults = 5): CofidFood[] {
    if (!this._foods) return [];
    const q = name.toLowerCase().trim();
    return this._foods
      .filter(f => f.food_name.toLowerCase().includes(q))
      .slice(0, maxResults);
  }

  getByCode(code: string): CofidFood | null {
    return this._foods?.find(f => f.food_code === code) ?? null;
  }

  toCanonicalProduct(food: CofidFood): CanonicalProduct {
    return normalizeCofidFood(food);
  }

  get size(): number {
    return this._foods?.length ?? 0;
  }
}
