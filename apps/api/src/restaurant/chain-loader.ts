// Restaurant Chain Nutrition ETL loader — Phase 5 (`global.p5.restaurant_etl`).
// Mirrors the CofidLoader pattern (apps/api/src/datasources/cofid/loader.ts): reads an
// offline dataset from disk when present, gracefully degrades to "not available" when absent.
//
// DEFERRED (ADR-0018): no licensed/public restaurant-chain nutrition dataset is wired up yet.
// Registering the loader interface and a graceful-degradation implementation now — rather than
// fabricating chain nutrition data — mirrors the EFSA/CIQUAL/BLS/FSANZ "registered inactive"
// precedent from ADR-0016: menu-scanner.ts and future callers can code against this interface
// today; a real dataset (e.g. US NLEA-mandated chain menu labeling disclosures) can be dropped
// in later with zero call-site changes.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAIN_DATA_PATH = resolve(__dirname, '../../data/restaurant-chains/chains.json');

export interface ChainMenuItem {
  chain_id:        string;    // e.g. 'mcdonalds_us'
  chain_name:       string;
  item_name:        string;
  country_code:     string;   // ISO 3166-1 alpha-2 market this item/pricing applies to
  energy_kcal:      number | null;
  protein_g:        number | null;
  fat_g:            number | null;
  fat_saturated_g:  number | null;
  carbohydrate_g:   number | null;
  sugars_g:         number | null;
  sodium_mg:        number | null;
  allergens:        string[];
}

/**
 * Loads restaurant chain nutrition disclosures from an offline dataset when present.
 * `isAvailable()` returns false (and every lookup returns empty/null) when no dataset is
 * installed — never throws, never fabricates data.
 */
export class RestaurantChainLoader {
  private _items: ChainMenuItem[] | null = null;
  private _available = false;

  async load(): Promise<void> {
    if (!existsSync(CHAIN_DATA_PATH)) {
      console.info(
        '[restaurant-chains] Dataset not found at', CHAIN_DATA_PATH,
        '— chain-nutrition lookup disabled (deferred, see ADR-0018)',
      );
      return;
    }
    try {
      const raw = await readFile(CHAIN_DATA_PATH, 'utf-8');
      this._items = JSON.parse(raw) as ChainMenuItem[];
      this._available = true;
      console.info('[restaurant-chains] Loaded', this._items.length, 'chain menu items');
    } catch (err) {
      console.warn('[restaurant-chains] Failed to load dataset:', err instanceof Error ? err.message : err);
    }
  }

  isAvailable(): boolean {
    return this._available && this._items !== null;
  }

  /** Look up a chain menu item by chain id + item name (case-insensitive substring match). */
  findItem(chainId: string, itemName: string): ChainMenuItem | null {
    if (!this._items) return null;
    const q = itemName.toLowerCase().trim();
    return this._items.find(
      (i) => i.chain_id === chainId && i.item_name.toLowerCase().includes(q),
    ) ?? null;
  }

  /** All known chain ids for a given country market. Empty when no dataset is loaded. */
  chainsForCountry(countryCode: string): string[] {
    if (!this._items) return [];
    const iso = countryCode.toUpperCase();
    return [...new Set(
      this._items.filter((i) => i.country_code === iso).map((i) => i.chain_id),
    )];
  }

  get size(): number {
    return this._items?.length ?? 0;
  }
}
