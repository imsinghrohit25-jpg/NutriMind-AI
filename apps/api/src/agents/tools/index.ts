// Shared Tool Registry — Phase 13 (§16.3). Every real tool, aggregated for tool-registry.ts.
import type { ToolDefinition } from '../types.js';
import { foodLookupTool, foodSearchTool } from './food.js';
import { nutritionComputeTool } from './nutrition.js';
import { allergenCheckTool } from './allergen.js';
import { alternativesRankTool } from './alternatives.js';
import { mealplanGenerateTool, mealplanOptimizeTool } from './mealplan.js';
import { groceryListTool, groceryPriceHistoryTool } from './grocery.js';
import { pantryStateTool } from './pantry.js';
import { restaurantLookupTool } from './restaurant.js';
import { ocrProcessTool } from './ocr.js';
import { biomarkerTrendsTool } from './biomarker.js';
import { countryProfileTool, countryTransitionTool } from './country.js';
import { memoryFactsTool } from './memory.js';
import { userGoalsTool, userProfileTool } from './user.js';
import { familyMembersTool } from './family.js';

export const ALL_TOOLS: ToolDefinition<unknown, unknown>[] = [
  foodLookupTool,
  foodSearchTool,
  nutritionComputeTool,
  allergenCheckTool,
  alternativesRankTool,
  mealplanGenerateTool,
  mealplanOptimizeTool,
  groceryListTool,
  groceryPriceHistoryTool,
  pantryStateTool,
  restaurantLookupTool,
  ocrProcessTool,
  biomarkerTrendsTool,
  countryProfileTool,
  countryTransitionTool,
  memoryFactsTool,
  userGoalsTool,
  userProfileTool,
  familyMembersTool,
] as unknown as ToolDefinition<unknown, unknown>[];

export * from './food.js';
export * from './nutrition.js';
export * from './allergen.js';
export * from './alternatives.js';
export * from './mealplan.js';
export * from './grocery.js';
export * from './pantry.js';
export * from './restaurant.js';
export * from './ocr.js';
export * from './biomarker.js';
export * from './country.js';
export * from './memory.js';
export * from './user.js';
export * from './family.js';
