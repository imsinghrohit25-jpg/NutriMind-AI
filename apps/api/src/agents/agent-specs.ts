// Agent specifications — Phase 13 (§16.4). The single source of truth for what each agent may
// touch: its tool allowlist (enforced at runtime by tool-registry.ts's callAsAgent — a call
// outside this list throws, it is never just "unused") and its memory-fact sections (§16.1.6:
// "agents receive only the sections relevant to them ... never the raw event store").

import type { AgentName, ToolName } from './types.js';
import type { MemoryFactType } from '../memory/aggregation/types.js';

export const AGENT_TOOL_ALLOWLISTS: Record<AgentName, ToolName[]> = {
  // 'user.goals' added with the AI Nutrition Intelligence upgrade — the general-advice and
  // product-explain paths both now fetch the user's stored TDEE/macro goals (falling back to
  // engine-derived targets from raw profile fields when absent) to personalize every response.
  nutrition: ['food.lookup', 'food.search', 'nutrition.compute', 'allergen.check', 'alternatives.rank', 'memory.facts', 'user.profile', 'user.goals'],
  meal_planning: ['mealplan.generate', 'mealplan.optimize', 'user.goals', 'user.profile', 'pantry.state', 'grocery.price_history', 'allergen.check', 'memory.facts'],
  grocery: ['grocery.list', 'grocery.price_history', 'pantry.state', 'alternatives.rank', 'food.search', 'memory.facts'],
  restaurant: ['ocr.process', 'restaurant.lookup', 'nutrition.compute', 'allergen.check', 'alternatives.rank', 'country.profile', 'user.profile'],
  biomarker: ['ocr.process', 'biomarker.trends', 'nutrition.compute', 'mealplan.optimize', 'memory.facts'],
  family: ['user.profile', 'family.members', 'mealplan.generate', 'mealplan.optimize', 'allergen.check', 'nutrition.compute'],
  travel_nutrition: ['country.profile', 'country.transition', 'food.search', 'restaurant.lookup', 'grocery.list', 'nutrition.compute', 'allergen.check', 'memory.facts', 'user.profile'],
  voice: [], // interface agent — delegates to the Supervisor, owns no domain tools itself (§16.4.8)
  ocr: ['ocr.process', 'food.lookup', 'pantry.state'],
};

/** §16.1.6: which memory-fact sections each agent's Memory Context Injector may surface. Agents
 *  not listed here (voice, ocr, restaurant — interface/pipeline agents with no personalization
 *  need) simply never receive a memory context pack; omission is a deliberate choice, not a gap. */
export const AGENT_MEMORY_SECTIONS: Partial<Record<AgentName, MemoryFactType[]>> = {
  nutrition: ['health_goal', 'eating_pattern', 'user_habit', 'regional_cuisine_affinity', 'seasonal_pattern'],
  meal_planning: ['health_goal', 'family_preference', 'seasonal_pattern', 'eating_pattern'],
  grocery: ['user_habit', 'seasonal_pattern'],
  biomarker: ['health_goal'],
  family: ['family_preference'],
  travel_nutrition: ['travel_history', 'regional_cuisine_affinity'],
};
