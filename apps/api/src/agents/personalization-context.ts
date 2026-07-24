// Personalization context for AI agent responses (AI Nutrition Intelligence upgrade).
// Pure, deterministic text-building from REAL data only — profile fields, engine-computed
// targets (engines/personalization), disease guidance (engines/disease/guidance), and already-
// derived memory facts (memory/context-assembler). No LLM call here, no invented numbers —
// matches this codebase's "Agents orchestrate and explain. Engines compute." principle
// (agents/explain.ts's own header comment) one level up: this module assembles what agents hand
// to explainWithFallback as grounding, and doubles as the deterministic-fallback content when no
// gateway is configured (e.g. an LLM provider quota outage) — so personalization survives even
// when the LLM does not.

import type { UserProfileOutput, UserGoalsOutput } from './tools/user.js';
import type { StoredMemoryFact } from '../memory/facts-service.js';
import { assembleMemoryContext } from '../memory/context-assembler.js';
import {
  computeEnergyTarget,
  type Sex as EngineSex,
  type ActivityLevel as EngineActivityLevel,
} from '../engines/personalization/targets.js';
import { computeDailyBudget, type DailyBudget } from '../engines/personalization/budgets.js';
import { CONDITION_GUIDANCE } from '../engines/disease/guidance.js';

// Wire-format maps, DB (users_profiles CHECK constraints, migration 0002) -> engine types.
// Same mapping as jobs/handlers/weekly-report.ts (kept local rather than imported to avoid
// coupling an agent-layer module to a jobs-layer one) — see that file's comment for the full
// history (ADR-0024/ADR-0025): 'prefer_not_to_say' has no engine equivalent (falls back to the
// same conservative 'other' BMR formula), and the DB's 5-level activity scale is offset by one
// name from the engine's ('very_active' in the DB is the engine's 'active' tier).
const DB_SEX_TO_ENGINE: Record<string, EngineSex> = {
  male: 'male',
  female: 'female',
  other: 'other',
  prefer_not_to_say: 'other',
};

const DB_ACTIVITY_TO_ENGINE: Record<string, EngineActivityLevel> = {
  sedentary: 'sedentary',
  lightly_active: 'light',
  moderately_active: 'moderate',
  very_active: 'active',
  extra_active: 'very_active',
};

export interface ComputedTargets {
  bmi: number;
  bmiCategory: 'underweight' | 'normal' | 'overweight' | 'obese';
  tdeeKcal: number;
  budget: DailyBudget;
  /** True when these targets came from the user's own stored goal/macro fields (set once during
   *  onboarding/profile edits) rather than being freshly derived here from height/weight/activity —
   *  callers may want to say "your saved target" vs "an estimate based on your profile". */
  fromStoredGoal: boolean;
}

function classifyBmi(bmi: number): ComputedTargets['bmiCategory'] {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

// ISSN Position Stand: Protein and Exercise (2017) — general population default stays the
// existing ICMR-NIN 0.83g/kg (budgets.ts's own default); athlete tiers raise it per that
// position stand's cited ranges. Deliberately conservative (low end of each range).
const ATHLETE_PROTEIN_G_PER_KG: Record<string, number> = {
  recreational: 1.2,
  competitive_endurance: 1.4,
  competitive_strength: 1.6,
};

function proteinGPerKgFor(athleteStatus: string | null): number | undefined {
  if (!athleteStatus || athleteStatus === 'none' || athleteStatus === 'other') return undefined;
  return ATHLETE_PROTEIN_G_PER_KG[athleteStatus];
}

// American Council on Exercise (ACE) body-fat-percentage categories — sex-specific because
// essential fat differs meaningfully between men and women. Used only to add a more accurate
// body-composition note alongside BMI (never instead of it — BMI still drives the energy/macro
// math via targets.ts, unchanged).
function classifyBodyFat(bodyFatPct: number, sex: EngineSex): string {
  const isFemale = sex === 'female';
  if (isFemale) {
    if (bodyFatPct < 14) return 'essential fat range';
    if (bodyFatPct < 21) return 'athletic';
    if (bodyFatPct < 25) return 'fitness';
    if (bodyFatPct < 32) return 'acceptable';
    return 'obese range';
  }
  if (bodyFatPct < 6) return 'essential fat range';
  if (bodyFatPct < 14) return 'athletic';
  if (bodyFatPct < 18) return 'fitness';
  if (bodyFatPct < 25) return 'acceptable';
  return 'obese range';
}

// WHO cardiometabolic-risk waist-circumference thresholds (sex-specific).
function waistRiskNote(waistCm: number, sex: EngineSex): string | null {
  const threshold = sex === 'female' ? 88 : 102;
  if (waistCm > threshold) {
    return `waist circumference (${waistCm}cm) is above the WHO threshold (${threshold}cm) associated with higher cardiometabolic risk`;
  }
  return null;
}

/** Computes real targets from the profile — prefers the user's own stored goal/TDEE/macros
 *  (set at profile-save time, engines/personalization/targets.ts + budgets.ts under the hood,
 *  see profile_setup_screen.dart) and only derives fresh ones here when those are absent AND
 *  enough raw fields (height/weight/age/sex/activity) are present. Returns null when neither is
 *  possible — never fabricates a target from partial data. */
export function computeTargets(
  profile: UserProfileOutput,
  goals?: UserGoalsOutput | null,
): ComputedTargets | null {
  const heightCm = profile.heightCm;
  const weightKg = profile.weightKg;
  if (!heightCm || !weightKg) return null;

  const bmi = Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
  const bmiCategory = classifyBmi(bmi);

  if (goals?.tdeeKcal && goals.macroProteinG && goals.macroFatG && goals.macroCarbsG) {
    return {
      bmi,
      bmiCategory,
      tdeeKcal: goals.tdeeKcal,
      budget: {
        energyKcal: goals.tdeeKcal,
        proteinG: goals.macroProteinG,
        fatTotalG: goals.macroFatG,
        // Stored goals don't break fat into saturated/trans or carbs into sugar bands — reuse
        // the same 2020 ICMR-NIN-derived ratios budgets.ts applies elsewhere for the fields the
        // stored goal doesn't cover, rather than leaving them blank.
        fatSaturatedG: Math.round((goals.tdeeKcal * 0.10) / 9),
        fatTransG: Math.round((goals.tdeeKcal * 0.01) / 9),
        carbohydratesG: goals.macroCarbsG,
        sugarsAddedG: Math.round((goals.tdeeKcal * 0.10) / 4),
        sodiumMg: 2000,
        dietaryFiberG: 30,
      },
      fromStoredGoal: true,
    };
  }

  if (!profile.ageYears || !profile.activityLevel) return null;
  const sex = DB_SEX_TO_ENGINE[profile.biologicalSex ?? ''] ?? 'other';
  const activityLevel = DB_ACTIVITY_TO_ENGINE[profile.activityLevel] ?? 'sedentary';

  const energy = computeEnergyTarget({ weightKg, heightCm, ageYears: profile.ageYears, sex, activityLevel });
  const budget = computeDailyBudget(
    { weightKg, heightCm, ageYears: profile.ageYears, sex, activityLevel },
    energy,
    { proteinGPerKg: proteinGPerKgFor(profile.athleteStatus) },
  );

  return { bmi, bmiCategory, tdeeKcal: energy.tdeeKcal, budget, fromStoredGoal: false };
}

/** One clinically-flavoured, cited highlight per stored condition — pulled from the same static
 *  CONDITION_GUIDANCE catalogue GET /v1/disease/guidance serves, so the chat's advice and the
 *  guidance screen's advice are always the same underlying content, never two sources of truth.
 *  `reproductiveStatus` (migration 0036) folds in 'pregnancy'/'lactation' guidance even when the
 *  matching condition chip isn't ticked — 'lactation' in particular has no chip at all. */
export function buildConditionHighlights(conditions: string[], reproductiveStatus?: string | null): string[] {
  const effective = [...conditions];
  if (reproductiveStatus === 'pregnant' && !effective.includes('pregnancy')) effective.push('pregnancy');
  if (reproductiveStatus === 'lactating' && !effective.includes('lactation')) effective.push('lactation');

  return effective
    .map((c) => CONDITION_GUIDANCE[c])
    .filter((g) => g !== undefined)
    .map((g) => `${g.label}: ${g.summary}`);
}

/** Flattens memory/context-assembler's section map into plain lines, reusing its existing
 *  confidence-ordered truncation — no new rendering logic, just a nutrition-agent-friendly shape. */
export function buildMemoryHighlights(userId: string, facts: StoredMemoryFact[]): string[] {
  if (facts.length === 0) return [];
  const pack = assembleMemoryContext(userId, facts, { maxTokens: 200 });
  return Object.values(pack.sections).flat();
}

export interface PersonalizationBlock {
  /** Full text block, ready to embed as grounding in an LLM prompt or as the basis of a
   *  deterministic fallback — every line traces to a real stored/computed value. */
  text: string;
  targets: ComputedTargets | null;
  conditionHighlights: string[];
  memoryHighlights: string[];
}

function activityLabel(dbValue: string | null): string {
  const labels: Record<string, string> = {
    sedentary: 'sedentary (little exercise)',
    lightly_active: 'lightly active (1-3 days/week exercise)',
    moderately_active: 'moderately active (3-5 days/week)',
    very_active: 'very active (6-7 days/week)',
    extra_active: 'extremely active (physical job or twice-daily training)',
  };
  return dbValue ? (labels[dbValue] ?? dbValue) : 'unknown activity level';
}

const BUDGET_LABELS: Record<string, string> = {
  budget: 'budget-conscious', moderate: 'moderate budget', premium: 'flexible/premium budget',
};
const ATHLETE_LABELS: Record<string, string> = {
  recreational: 'a recreational athlete', competitive_endurance: 'a competitive endurance athlete',
  competitive_strength: 'a competitive strength athlete', other: 'active in sport',
};
const MEAL_TIMING_LABELS: Record<string, string> = {
  intermittent_fasting_16_8: 'follows a 16:8 intermittent-fasting window',
  intermittent_fasting_18_6: 'follows an 18:6 intermittent-fasting window',
  early_dinner: 'prefers an early dinner', late_dinner: 'tends to eat dinner late',
  shift_work: 'works shifts, so meal timing varies', standard: 'eats on a standard 3-meals-a-day schedule',
};

export function buildPersonalizationBlock(opts: {
  profile: UserProfileOutput;
  goals?: UserGoalsOutput | null;
  memoryFacts?: StoredMemoryFact[];
}): PersonalizationBlock {
  const { profile, goals, memoryFacts = [] } = opts;
  const targets = computeTargets(profile, goals);
  const conditionHighlights = buildConditionHighlights(profile.conditions, profile.reproductiveStatus);
  const memoryHighlights = buildMemoryHighlights(profile.displayName, memoryFacts);
  const sex = DB_SEX_TO_ENGINE[profile.biologicalSex ?? ''] ?? 'other';

  const lines: string[] = [];

  const demographic = [
    profile.ageYears ? `${profile.ageYears}-year-old` : null,
    profile.biologicalSex && profile.biologicalSex !== 'prefer_not_to_say' ? profile.biologicalSex : null,
  ].filter(Boolean).join(' ');
  const bodyStats = [
    profile.weightKg ? `${profile.weightKg}kg` : null,
    profile.heightCm ? `${profile.heightCm}cm` : null,
    targets ? `BMI ${targets.bmi} (${targets.bmiCategory})` : null,
    profile.bodyFatPct ? `${profile.bodyFatPct}% body fat (${classifyBodyFat(profile.bodyFatPct, sex)})` : null,
  ].filter(Boolean).join(', ');
  const athleteNote = profile.athleteStatus && profile.athleteStatus !== 'none'
    ? `, ${ATHLETE_LABELS[profile.athleteStatus] ?? profile.athleteStatus}` : '';
  lines.push(
    `User: ${demographic || 'profile incomplete'}${bodyStats ? `, ${bodyStats}` : ''}, ` +
    `${activityLabel(profile.activityLevel)}${athleteNote}, diet: ${profile.dietType ?? 'not set'}` +
    `${profile.preferredCountry ? `, based in ${profile.preferredCountry}` : ''}.`,
  );

  if (targets) {
    lines.push(
      `Daily targets${targets.fromStoredGoal ? '' : ' (estimated from profile)'}: ` +
      `~${targets.tdeeKcal} kcal, ${targets.budget.proteinG}g protein, ${targets.budget.fatTotalG}g fat, ` +
      `${targets.budget.carbohydratesG}g carbs, ${targets.budget.dietaryFiberG}g fiber, ` +
      `< ${targets.budget.sodiumMg}mg sodium.`,
    );
  }

  if (profile.waistCircumferenceCm) {
    const note = waistRiskNote(profile.waistCircumferenceCm, sex);
    if (note) lines.push(`Note: ${note} (WHO); worth mentioning if discussing weight or heart health.`);
  }

  if (profile.allergens.length > 0) {
    lines.push(`Declared allergens (must never be recommended): ${profile.allergens.join(', ')}.`);
  }

  if (profile.medications.length > 0) {
    lines.push(`Declared medications: ${profile.medications.join(', ')} (consider food-drug interactions).`);
  }

  if (conditionHighlights.length > 0) {
    lines.push(`Health conditions on file: ${conditionHighlights.join(' ')}`);
  }

  const lifestyleParts = [
    profile.sleepHoursAvg ? `averages ${profile.sleepHoursAvg}h sleep/night` : null,
    profile.stressLevel && profile.stressLevel !== 'low' ? `reports ${profile.stressLevel} stress` : null,
    profile.mealTimingPattern ? MEAL_TIMING_LABELS[profile.mealTimingPattern] ?? null : null,
  ].filter(Boolean);
  if (lifestyleParts.length > 0) {
    lines.push(
      `Lifestyle: ${lifestyleParts.join('; ')}. (General wellness context, not a clinical assessment — ` +
      `short sleep and high stress are both associated with appetite/craving changes worth being gentle about.)`,
    );
  }

  if (profile.budgetLevel && profile.budgetLevel !== 'moderate') {
    lines.push(`Grocery budget: ${BUDGET_LABELS[profile.budgetLevel] ?? profile.budgetLevel} — favour matching suggestions.`);
  }

  if (memoryHighlights.length > 0) {
    lines.push(`What we remember about this user: ${memoryHighlights.join(' ')}`);
  }

  return { text: lines.join('\n'), targets, conditionHighlights, memoryHighlights };
}

/** One deterministic, context-aware follow-up question — every AI Diet Chat response must end
 *  with exactly one (mission requirement), and this must not depend on the LLM reliably
 *  following a prompt instruction (it's appended in code, not just requested in the prompt). Asks
 *  about the single biggest gap in what we know, or deepens personalization when nothing is
 *  missing — never repeats the user's own question. */
export function buildFollowUpQuestion(profile: UserProfileOutput, targets: ComputedTargets | null): string {
  if (!profile.activityLevel) return 'How active are you on a typical day — that helps me size your calorie and protein targets correctly.';
  if (!profile.dietType) return 'Do you eat vegetarian, vegan, or non-vegetarian, so I can tailor suggestions you\'ll actually eat?';
  if (!targets) return 'Could you add your height and weight to your profile? That lets me give you exact daily targets instead of general ranges.';
  if (profile.conditions.length === 0 && !profile.reproductiveStatus) {
    return 'Do you have any health conditions I should factor in (like diabetes or high blood pressure), or is general healthy eating the goal?';
  }
  if (!profile.budgetLevel) {
    return 'What\'s your typical grocery budget — should I lean toward budget-friendly staples or is a wider range okay?';
  }
  return 'Would you like this broken down into a full day\'s meal plan, or focused on just your next meal?';
}
