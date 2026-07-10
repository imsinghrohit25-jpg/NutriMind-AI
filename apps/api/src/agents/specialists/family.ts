// Family Agent — Phase 13 (§16.4.6). Flow: family.members (real household roster) -> shared-meal
// planning = constraint intersection (most-restrictive diet type across members, union of every
// member's allergens) via mealplan.generate -> allergen.check on every suggestion for every
// affected member (the Family Allergen Guardian's own principle: the gate prevents, the agent
// only explains).
//
// Honest, documented gap: per-member life-stage rule layers (child/senior nutrition packs, §3.5)
// were deferred in Phase 4 (ADR-0017's `life_stage_rules` flag, seeded but never implemented) —
// this agent computes a simple age BRACKET per member (child/adult/senior) for display only, not
// a real life-stage rule pack that doesn't exist yet.

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { makeAgentToolCaller } from '../agent-runner.js';
import type { FamilyMemberProfile } from '../tools/family.js';
import type { MealPlanGenerateOutput } from '../tools/mealplan.js';
import type { AllergenCheckOutput } from '../tools/allergen.js';
import type { MealPlanConstraints } from '../../planner/meal-plan-generator.js';
import type { DietType } from '../../restaurant/recipe-generator.js';
import { explainWithFallback } from '../explain.js';

const DB_DIET_TO_RECIPE_DIET: Record<string, DietType> = {
  vegetarian: 'vegetarian', non_vegetarian: 'non-vegetarian', vegan: 'vegan',
  eggetarian: 'eggetarian', jain: 'vegetarian', other: 'vegetarian',
};

// Most restrictive first — "constraint intersection" picks the first one any member requires.
const DIET_RESTRICTIVENESS: DietType[] = ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'];

function mostRestrictiveDiet(members: FamilyMemberProfile[]): DietType {
  const dietTypes = members.map((m) => DB_DIET_TO_RECIPE_DIET[m.dietType ?? 'vegetarian'] ?? 'vegetarian');
  for (const tier of DIET_RESTRICTIVENESS) {
    if (dietTypes.includes(tier)) return tier;
  }
  return 'vegetarian';
}

function ageBracket(ageYears: number | null): 'child' | 'adult' | 'senior' | 'unknown' {
  if (ageYears == null) return 'unknown';
  if (ageYears < 18) return 'child';
  if (ageYears >= 60) return 'senior';
  return 'adult';
}

export const runFamilyAgent: SpecialistAgentRunner = async (input) => {
  const { call, trace } = makeAgentToolCaller('family', input.registry, input.ctx);

  const members = await call<Record<string, never>, FamilyMemberProfile[]>('family.members', {});
  if (members.length === 0) {
    return {
      responseText: `You're not part of a family group yet — set one up first to plan shared meals.`,
      toolTrace: trace,
    };
  }

  if (!input.ctx.gateway) {
    return {
      responseText: `Family meal planning needs the AI recipe generator, which isn't configured in this environment. Household: ${members.map((m) => `${m.displayName} (${ageBracket(m.ageYears)})`).join(', ')}.`,
      toolTrace: trace,
    };
  }

  const allergenUnion = [...new Set(members.flatMap((m) => m.allergens))];
  const constraints: MealPlanConstraints = {
    kcalTarget: 2000, // no single shared TDEE across members with different profiles — a neutral default, never invented as any one member's real figure
    proteinTarget: 0,
    dietType: mostRestrictiveDiet(members),
    allergens: allergenUnion,
    durationDays: 7,
  };

  const planResult = await call<{ title: string; startDate: string; constraints: MealPlanConstraints }, MealPlanGenerateOutput>(
    'mealplan.generate',
    { title: 'Family plan', startDate: new Date().toISOString().slice(0, 10), constraints },
  );

  let allergenCheckSummary = '';
  if (allergenUnion.length > 0) {
    const ingredientNames = planResult.days.flatMap((d) =>
      [d.breakfast, d.lunch, d.dinner, d.snack].filter(Boolean).map((m) => m!.recipeName),
    );
    const check = await call<Parameters<typeof call>[1], AllergenCheckOutput>('allergen.check', {
      ingredientNames, rawLabelText: ingredientNames.join(', '),
      members: members.map((m) => ({ memberId: m.userId, memberName: m.displayName, allergens: m.allergens })),
    } as never);
    if (check.anyBlocked) {
      allergenCheckSummary = ` Note: some recipe names matched a declared allergen keyword — please review before cooking.`;
    }
  }

  const template =
    `Created a shared 7-day plan (${constraints.dietType}, avoiding: ${allergenUnion.join(', ') || 'no shared allergens'}) ` +
    `for ${members.length} household member(s): ${members.map((m) => `${m.displayName} (${ageBracket(m.ageYears)})`).join(', ')}.` +
    allergenCheckSummary;

  const responseText = await explainWithFallback({
    gateway: input.ctx.gateway,
    systemPrompt: 'You are a family meal-planning assistant. Explain the shared plan and any allergen notes conversationally. Never invent a number.',
    userMessage: input.message,
    templateFallback: template,
    locale: input.locale,
  });

  return { responseText, toolTrace: trace, handoffState: { mealPlanId: planResult.planId } };
};
