// restaurant.lookup — Phase 13 (§16.3). "Provenance or ESTIMATED flag always present." Wraps
// restaurant/chain-loader.ts (RestaurantChainLoader — real, tested, but never had a caller
// anywhere until this tool; ADR-0018 explicitly built it "so future callers can code against
// this interface today," this is that caller) for chain-disclosed nutrition when a matching
// chain dataset item exists, falling back to restaurant/menu-scanner.ts's
// estimateMenuItemNutrition() (deterministic density-based estimate, always isEstimated:true)
// otherwise — and scoreMenuItemForUser() for the deterministic suitability verdict.

import type { ToolDefinition } from '../types.js';
import { RestaurantChainLoader, type ChainMenuItem } from '../../restaurant/chain-loader.js';
import {
  scoreMenuItemForUser,
  estimateMenuItemNutrition,
  type MenuItem,
  type MenuItemNutritionEstimate,
} from '../../restaurant/menu-scanner.js';

// Module-level singleton — mirrors datasources/cofid/loader.ts's own pattern (load once, cheap
// isAvailable() checks after). `.load()` is a no-op-safe file-existence check when the dataset
// isn't installed (this environment: it never is — see ADR-0018), never fabricates data.
let chainLoaderInstance: RestaurantChainLoader | null = null;
async function getChainLoader(): Promise<RestaurantChainLoader> {
  if (!chainLoaderInstance) {
    chainLoaderInstance = new RestaurantChainLoader();
    await chainLoaderInstance.load();
  }
  return chainLoaderInstance;
}

export interface RestaurantLookupInput {
  item: MenuItem;
  chainId?: string;
  userSodiumGoalMg: number;
  isVegPreference: boolean;
  allergens: string[];
}

export type RestaurantNutritionResult =
  | { source: 'chain_disclosure'; data: ChainMenuItem }
  | { source: 'estimated'; data: MenuItemNutritionEstimate };

export interface RestaurantLookupOutput {
  nutrition: RestaurantNutritionResult;
  scoring: ReturnType<typeof scoreMenuItemForUser>;
}

export const restaurantLookupTool: ToolDefinition<RestaurantLookupInput, RestaurantLookupOutput> = {
  name: 'restaurant.lookup',
  description: 'Look up a menu item\'s nutrition — real chain disclosure when available, otherwise a clearly-flagged density-based estimate. Never presents an estimate as measured.',
  execute: async (input) => {
    const { item, chainId, userSodiumGoalMg, isVegPreference, allergens } = input;

    let nutrition: RestaurantNutritionResult;
    const loader = await getChainLoader();
    const chainMatch = chainId && loader.isAvailable() ? loader.findItem(chainId, item.name) : null;

    if (chainMatch) {
      nutrition = { source: 'chain_disclosure', data: chainMatch };
    } else {
      nutrition = { source: 'estimated', data: estimateMenuItemNutrition(item) };
    }

    const scoring = scoreMenuItemForUser({
      item,
      userSodiumGoal: userSodiumGoalMg,
      isVeg: isVegPreference,
      allergens,
    });

    return { nutrition, scoring };
  },
};
