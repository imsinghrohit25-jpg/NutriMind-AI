// Multi-Agent System — shared types. Phase 13 (§16).
//
// Governing principle (§16.1.1): "Agents orchestrate and explain. Engines compute." Every tool
// here wraps a REAL, already-existing deterministic engine or data-access function — no tool
// computes a number itself; it calls through to engines/score, engines/allergen, planner/*, etc.
// and returns their real output unchanged.

import type { SupabaseClient } from '@supabase/supabase-js';
import type postgres from 'postgres';
import type { GatewayRouter } from '../gateway/router.js';
import type { OpenFoodFactsClient } from '../datasources/openfoodfacts/client.js';
import type { UsdaFdcClient } from '../datasources/usda/client.js';
import type { IfctLoader } from '../datasources/ifct/loader.js';
import type { CofidLoader } from '../datasources/cofid/loader.js';
import type { EdgeCache } from '../cache/edge-cache.js';
import type { CanonicalProduct } from '../nutrition/canonical-model.js';

/** Everything a tool implementation might need — a subset of what app.ts already decorates onto
 *  the Fastify instance, plus the requesting user's id (tools are always scoped to one user;
 *  there is no "system" tool call with no owner). */
export interface ToolContext {
  supabase: SupabaseClient;
  sql: postgres.Sql;
  gateway: GatewayRouter | null;
  offClient: OpenFoodFactsClient;
  usdaClient: UsdaFdcClient | null;
  ifct: IfctLoader;
  cofid: CofidLoader;
  productCache?: EdgeCache<CanonicalProduct>;
  userId: string;
  /** ISO country code, when resolved (request.country per country/plugin.ts) — several tools
   *  (country.*, restaurant.lookup, grocery.price_history) are country-aware. */
  countryCode?: string;
}

/** Every tool name the registry can dispatch — the addendum's §16.3 table, one entry per row
 *  (rows with "a / b" split into two names sharing one underlying implementation file). */
export type ToolName =
  | 'food.lookup'
  | 'food.search'
  | 'nutrition.compute'
  | 'allergen.check'
  | 'alternatives.rank'
  | 'mealplan.generate'
  | 'mealplan.optimize'
  | 'grocery.list'
  | 'grocery.price_history'
  | 'pantry.state'
  | 'restaurant.lookup'
  | 'ocr.process'
  | 'biomarker.trends'
  | 'country.profile'
  | 'country.transition'
  | 'memory.facts'
  | 'user.goals'
  | 'user.profile'
  // Not one of the addendum's explicit §16.3 table rows — a real, necessary addition: the
  // Family Agent's own flow (§16.4.6, "member CRUD via profile services") needs a way to read
  // OTHER household members' diet/allergen profiles (real separate user accounts under
  // family/family-service.ts's group model, not sub-profiles of one head user), which no
  // existing tool provides. Wraps the same real family_members table + RLS-membership model
  // already built (Phase 19/family-service.ts), not a new data model.
  | 'family.members';

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: ToolName;
  description: string;
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

/** Thrown when an agent calls a tool outside its declared allowlist — a runtime error, not a
 *  warning (§16.1.3: "An agent calling a tool outside its allowlist is a runtime error"). */
export class ToolNotAllowedError extends Error {
  constructor(
    public readonly agentName: string,
    public readonly toolName: ToolName,
    public readonly allowlist: readonly ToolName[],
  ) {
    super(
      `Agent "${agentName}" is not allowed to call tool "${toolName}" ` +
      `(allowlist: ${allowlist.join(', ')})`,
    );
    this.name = 'ToolNotAllowedError';
  }
}

export class ToolNotFoundError extends Error {
  constructor(public readonly toolName: string) {
    super(`No tool registered with name "${toolName}"`);
    this.name = 'ToolNotFoundError';
  }
}

export type AgentName =
  | 'nutrition'
  | 'meal_planning'
  | 'grocery'
  | 'restaurant'
  | 'biomarker'
  | 'family'
  | 'travel_nutrition'
  | 'voice'
  | 'ocr';

/** Numeric claim extracted from agent-generated text, to be checked against real tool results
 *  by the Output Guard (agents/output-guard.ts) — never trusted from the LLM's own arithmetic. */
export interface NumericClaim {
  raw: string;
  value: number;
  unit: string | null;
}
