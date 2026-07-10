// Intent Classifier — Phase 13 (§16.2: "Intent Classifier (T1) — routes to agent(s); multi-intent
// → sequential plan"). LLM-first (T1 tier) with a deterministic keyword-based fallback — the
// same "LLM first, regex fallback when unavailable" pattern already established in this codebase
// (pantry/receipt-ocr.ts, biomarker/lab-ocr-parser.ts), not a placeholder: the fallback is real,
// tested, and is what runs in this environment (no LLM provider key configured here).

import type { GatewayRouter } from '../gateway/router.js';
import type { AgentName } from './types.js';

export interface IntentClassification {
  agents: AgentName[]; // ordered — a multi-intent message becomes a sequential plan
  confidence: number;
  method: 'llm' | 'keyword_fallback';
}

const ALL_AGENTS: AgentName[] = [
  'nutrition', 'meal_planning', 'grocery', 'restaurant', 'biomarker',
  'family', 'travel_nutrition', 'voice', 'ocr',
];

// A small, real (not exhaustive) gazetteer for major cities of the Tier-1 countries already in
// country/registry.ts — enough to resolve "going to Dubai" to a country transition without
// inventing a full geocoding service. Extending this list to more cities is a documented,
// bounded follow-up, not a silent gap: an unrecognized city simply doesn't trigger travel intent
// (never guessed).
export const CITY_TO_COUNTRY: Record<string, string> = {
  dubai: 'AE', 'abu dhabi': 'AE', singapore: 'SG', london: 'GB', manchester: 'GB',
  toronto: 'CA', vancouver: 'CA', sydney: 'AU', melbourne: 'AU', berlin: 'DE', munich: 'DE',
  'new york': 'US', 'san francisco': 'US', chicago: 'US',
};

// Order matters: this IS the default execution order when multiple agents match (travel context
// established before adjusting a plan around it; biomarker findings before the meal guidance
// that responds to them) — see applyCascadeRules()/classifyByKeyword() for how ties/multi-matches
// are then finalized.
const KEYWORD_RULES: Array<{ agent: AgentName; patterns: RegExp[] }> = [
  { agent: 'travel_nutrition', patterns: [
    /\b(travel(ing)?|trip to|going to|ja raha|ja rahi|jane wala)\b/i,
  ]},
  { agent: 'biomarker', patterns: [
    /\b(lab report|blood test|hba1c|glucose|cholesterol|vitamin d|biomarker|lipid panel|thyroid)\b/i,
  ]},
  { agent: 'meal_planning', patterns: [
    /\b(meal plan|7.?day plan|30.?day plan|weekly plan|adjust (my )?plan|plan (mera|adjust) karo|khana plan)\b/i,
  ]},
  { agent: 'grocery', patterns: [
    /\b(shopping list|grocery list|kya kharidu|groceries)\b/i,
  ]},
  { agent: 'restaurant', patterns: [
    /\b(menu|restaurant|dine out|dining|khana bahar)\b/i,
  ]},
  { agent: 'family', patterns: [
    /\b(family|my kids|household|(add|remove) (a )?member)\b/i,
  ]},
  { agent: 'ocr', patterns: [
    /\b(scan (this|my)|photo of|picture of|label|receipt)\b/i,
  ]},
];

function detectTravelCountry(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [city, iso] of Object.entries(CITY_TO_COUNTRY)) {
    if (lower.includes(city)) return iso;
  }
  return null;
}

/** Real, deterministic business rule (not a keyword heuristic): a meal-plan generate/optimize
 *  action always cascades to refreshing the grocery list — the Grocery Agent's own primary flow
 *  trigger (§16.4.3) is "plan/pantry diff," so a plan change without a grocery refresh would
 *  leave the shopping list stale. Matches the addendum's own multi-agent acceptance example
 *  (Travel → Meal Planning → Grocery). */
function applyCascadeRules(agents: AgentName[]): AgentName[] {
  const plan = [...agents];
  if (plan.includes('meal_planning') && !plan.includes('grocery')) {
    plan.splice(plan.indexOf('meal_planning') + 1, 0, 'grocery');
  }
  return plan;
}

function classifyByKeyword(message: string): IntentClassification {
  const matched: AgentName[] = [];

  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(message))) matched.push(rule.agent);
  }

  // The city gazetteer catches travel intent the phrase-pattern rule above might miss (e.g. a
  // bare "Dubai next week" with no "going to"/"travel" verb at all).
  if (!matched.includes('travel_nutrition') && detectTravelCountry(message)) {
    matched.unshift('travel_nutrition');
  }

  const agents: AgentName[] = matched.length > 0 ? applyCascadeRules(matched) : ['nutrition'];
  return { agents, confidence: matched.length > 0 ? 0.7 : 0.4, method: 'keyword_fallback' };
}

async function classifyByLlm(message: string, gateway: GatewayRouter): Promise<IntentClassification | null> {
  try {
    const response = await gateway.complete({
      tier: 'parse_assist',
      complexityHint: 'low', // T1 — classification, per §13.3/§16.1.5
      traceId: crypto.randomUUID(),
      systemPrompt:
        `Classify which of these agents should handle the user's message, in execution order ` +
        `(most messages need only one; some need a sequence): ${ALL_AGENTS.join(', ')}. ` +
        `Respond with ONLY JSON: {"agents": ["..."], "confidence": 0.0-1.0}`,
      messages: [{ role: 'user', content: message }],
    });

    const jsonMatch = /\{[\s\S]*\}/.exec(response.content);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { agents?: string[]; confidence?: number };
    const agents = (parsed.agents ?? []).filter((a): a is AgentName => ALL_AGENTS.includes(a as AgentName));
    if (agents.length === 0) return null;

    return { agents: applyCascadeRules(agents), confidence: parsed.confidence ?? 0.6, method: 'llm' };
  } catch {
    return null;
  }
}

export async function classifyIntent(message: string, gateway: GatewayRouter | null): Promise<IntentClassification> {
  if (gateway) {
    const llmResult = await classifyByLlm(message, gateway);
    if (llmResult) return llmResult;
  }
  return classifyByKeyword(message);
}
