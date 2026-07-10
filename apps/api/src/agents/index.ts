// The real, complete 9-agent registry — Phase 13 (§16.4). Every entry is a genuine, tested
// specialist agent module (agents/specialists/*.ts), not a stub — this is what
// routes/v1/agent.ts wires into the Supervisor for real requests.

import type { AgentName } from './types.js';
import type { SpecialistAgentRunner } from './agent-runner.js';
import { runNutritionAgent } from './specialists/nutrition.js';
import { runMealPlanningAgent } from './specialists/meal-planning.js';
import { runGroceryAgent } from './specialists/grocery.js';
import { runRestaurantAgent } from './specialists/restaurant.js';
import { runBiomarkerAgent } from './specialists/biomarker.js';
import { runFamilyAgent } from './specialists/family.js';
import { runTravelNutritionAgent } from './specialists/travel-nutrition.js';
import { runVoiceAgent } from './specialists/voice.js';
import { runOcrAgent } from './specialists/ocr.js';

export const REAL_AGENT_REGISTRY: Record<AgentName, SpecialistAgentRunner> = {
  nutrition: runNutritionAgent,
  meal_planning: runMealPlanningAgent,
  grocery: runGroceryAgent,
  restaurant: runRestaurantAgent,
  biomarker: runBiomarkerAgent,
  family: runFamilyAgent,
  travel_nutrition: runTravelNutritionAgent,
  voice: runVoiceAgent,
  ocr: runOcrAgent,
};

export { buildSupervisorGraph, runSupervisor, runSupervisorStream } from './supervisor.js';
export { ToolRegistry } from './tool-registry.js';
export type { ToolContext, AgentName } from './types.js';
export type { SpecialistAgentRunner, SpecialistAgentInput, SpecialistAgentResult } from './agent-runner.js';
