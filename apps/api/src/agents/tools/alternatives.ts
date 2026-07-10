// alternatives.rank — Phase 13 (§16.3). Wraps memory/ranker.ts's rankRecommendations() directly.
//
// Contract inherited from ranker.ts (unchanged, not re-implemented): candidates passed in MUST
// already be safety-filtered (allergen/rule-engine compliant) by the caller — the ranker only
// ever reorders, never removes or adds a candidate, same length in and out. An agent calling
// this tool is responsible for calling allergen.check on its candidate list FIRST and excluding
// any 'block' verdicts before ranking; this tool does not and cannot enforce that itself (it has
// no visibility into what a candidate even is beyond {id, cuisine, isSeasonalMatch}).

import type { ToolDefinition, ToolContext } from '../types.js';
import { rankRecommendations, type RankableCandidate } from '../../memory/ranker.js';
import { getFacts } from '../../memory/facts-service.js';

export interface AlternativesRankInput {
  candidates: RankableCandidate[];
  recentFeedback?: Array<{ recommendationId: string; action: string }>;
}

export const alternativesRankTool: ToolDefinition<AlternativesRankInput, RankableCandidate[]> = {
  name: 'alternatives.rank',
  description: 'Reorder a pre-filtered, already-safe candidate list by cuisine affinity + seasonality + recent-rejection novelty. Never removes a candidate. Caller must pre-filter for safety via allergen.check.',
  execute: async (input, ctx) => {
    const facts = await getFacts(ctx.supabase, ctx.userId);
    return rankRecommendations(input.candidates, facts, input.recentFeedback ?? []);
  },
};
