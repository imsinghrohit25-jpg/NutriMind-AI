// food.lookup / food.search — Phase 13 (§16.3). Wraps resolution/waterfall.ts's resolveBarcode/
// resolveByName exactly as routes/v1/resolve.ts already calls them — same waterfall, same cache
// behavior, no parallel/duplicate resolution logic.

import type { ToolDefinition, ToolContext } from '../types.js';
import { resolveBarcode, resolveByName, type ResolutionResult } from '../../resolution/waterfall.js';

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
    edgeCache: ctx.productCache,
  };
}

export const foodLookupTool: ToolDefinition<FoodLookupInput, ResolutionResult> = {
  name: 'food.lookup',
  description: 'Resolve a scanned barcode to a canonical product (name, brand, per-100g nutrition, provenance).',
  execute: async (input, ctx) =>
    resolveBarcode(input.barcode, toolDeps(ctx), { userId: ctx.userId, persistResult: true }),
};

export const foodSearchTool: ToolDefinition<FoodSearchInput, ResolutionResult> = {
  name: 'food.search',
  description: 'Resolve a food/ingredient name to a canonical product when no barcode is available.',
  execute: async (input, ctx) =>
    resolveByName(input.name, toolDeps(ctx), { userId: ctx.userId, persistResult: true }),
};
