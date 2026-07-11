// food.lookup / food.search — Phase 13 (§16.3). Wraps resolution/country-waterfall.ts's
// resolveBarcode/resolveByName exactly as routes/v1/resolve.ts calls them (ADR-0033 §11) — same
// country-aware waterfall, same cache behavior, no parallel/duplicate resolution logic. Byte-
// identical to the plain waterfall when `global.p3.unified_food_schema` is off (its default).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolDefinition, ToolContext } from '../types.js';
import { resolveBarcode, resolveByName, type GlobalResolutionResult } from '../../resolution/country-waterfall.js';
import { lookupCountryOrGlobal } from '../../country/registry.js';

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
export function _resetFoodToolFlagCache(): void {
  _flagEnabled = false;
  _cacheExpiry = 0;
}

export interface FoodLookupInput {
  barcode: string;
}

export interface FoodSearchInput {
  name: string;
}

function toolDeps(ctx: ToolContext) {
  return {
    sql: ctx.sql,
    offClient: ctx.offClient,
    ifct: ctx.ifct,
    usdaClient: ctx.usdaClient,
    cofid: ctx.cofid,
    edgeCache: ctx.productCache,
  };
}

export const foodLookupTool: ToolDefinition<FoodLookupInput, GlobalResolutionResult> = {
  name: 'food.lookup',
  description: 'Resolve a scanned barcode to a canonical product (name, brand, per-100g nutrition, provenance).',
  execute: async (input, ctx) => {
    const engineEnabled = await isUnifiedFoodSchemaEnabled(ctx.supabase);
    return resolveBarcode(
      input.barcode,
      lookupCountryOrGlobal(ctx.countryCode ?? 'GLOBAL'),
      toolDeps(ctx),
      { userId: ctx.userId, persistResult: true, engineEnabled },
    );
  },
};

export const foodSearchTool: ToolDefinition<FoodSearchInput, GlobalResolutionResult> = {
  name: 'food.search',
  description: 'Resolve a food/ingredient name to a canonical product when no barcode is available.',
  execute: async (input, ctx) => {
    const engineEnabled = await isUnifiedFoodSchemaEnabled(ctx.supabase);
    return resolveByName(
      input.name,
      lookupCountryOrGlobal(ctx.countryCode ?? 'GLOBAL'),
      toolDeps(ctx),
      { userId: ctx.userId, persistResult: true, engineEnabled },
    );
  },
};
