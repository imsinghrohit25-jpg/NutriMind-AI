import { describe, it, expect } from 'vitest';
import {
  computeTargets,
  buildConditionHighlights,
  buildMemoryHighlights,
  buildPersonalizationBlock,
  buildFollowUpQuestion,
} from '../personalization-context.js';
import type { UserProfileOutput, UserGoalsOutput } from '../tools/user.js';
import type { StoredMemoryFact } from '../../memory/facts-service.js';

function makeProfile(overrides: Partial<UserProfileOutput> = {}): UserProfileOutput {
  return {
    displayName: 'Asha', ageYears: 30, biologicalSex: 'female', heightCm: 165, weightKg: 60,
    activityLevel: 'moderately_active', dietType: 'vegetarian', conditions: [], allergens: [],
    preferredLanguage: 'en', preferredCountry: 'IN',
    medications: [], budgetLevel: null, sleepHoursAvg: null, stressLevel: null,
    mealTimingPattern: null, religion: null, reproductiveStatus: null, athleteStatus: null,
    bodyFatPct: null, waistCircumferenceCm: null,
    ...overrides,
  };
}

describe('computeTargets', () => {
  it('returns null when height/weight are missing (never fabricates from partial data)', () => {
    expect(computeTargets(makeProfile({ heightCm: null }))).toBeNull();
    expect(computeTargets(makeProfile({ weightKg: null }))).toBeNull();
  });

  it('returns null when age/activity are missing and no stored goal exists', () => {
    expect(computeTargets(makeProfile({ ageYears: null }))).toBeNull();
    expect(computeTargets(makeProfile({ activityLevel: null }))).toBeNull();
  });

  it('prefers the stored goal/macros over deriving fresh ones', () => {
    const goals: UserGoalsOutput = { goal: 'lose', tdeeKcal: 1800, macroProteinG: 90, macroFatG: 60, macroCarbsG: 200 };
    const t = computeTargets(makeProfile(), goals);
    expect(t).not.toBeNull();
    expect(t!.fromStoredGoal).toBe(true);
    expect(t!.tdeeKcal).toBe(1800);
    expect(t!.budget.proteinG).toBe(90);
  });

  it('derives fresh targets from raw profile fields when no stored goal is present', () => {
    const t = computeTargets(makeProfile());
    expect(t).not.toBeNull();
    expect(t!.fromStoredGoal).toBe(false);
    expect(t!.tdeeKcal).toBeGreaterThan(0);
    expect(t!.bmi).toBeCloseTo(60 / (1.65 * 1.65), 1);
  });

  it('classifies BMI correctly', () => {
    expect(computeTargets(makeProfile({ weightKg: 45, heightCm: 165 }))!.bmiCategory).toBe('underweight');
    expect(computeTargets(makeProfile({ weightKg: 60, heightCm: 165 }))!.bmiCategory).toBe('normal');
    expect(computeTargets(makeProfile({ weightKg: 75, heightCm: 165 }))!.bmiCategory).toBe('overweight');
    expect(computeTargets(makeProfile({ weightKg: 95, heightCm: 165 }))!.bmiCategory).toBe('obese');
  });

  it('maps the DB activity/sex vocabulary correctly (offset-by-one bug class, ADR-0024/0025)', () => {
    // very_active in the DB maps to the engine's 'active' tier, not 'very_active'
    const veryActive = computeTargets(makeProfile({ activityLevel: 'very_active' }));
    const extraActive = computeTargets(makeProfile({ activityLevel: 'extra_active' }));
    expect(extraActive!.tdeeKcal).toBeGreaterThan(veryActive!.tdeeKcal);
  });
});

describe('buildConditionHighlights', () => {
  it('returns one labeled highlight per known condition, skips unknown slugs', () => {
    const highlights = buildConditionHighlights(['diabetes', 'other', 'pcos']);
    expect(highlights).toHaveLength(2);
    expect(highlights[0]).toMatch(/^Diabetes:/);
    expect(highlights[1]).toMatch(/^PCOS:/);
  });

  it('empty conditions -> empty array', () => {
    expect(buildConditionHighlights([])).toEqual([]);
  });
});

describe('buildMemoryHighlights', () => {
  it('renders known fact keys into readable lines', () => {
    const facts: StoredMemoryFact[] = [{
      factId: 'f1', factType: 'health_goal', factKey: 'active_goal',
      value: { goal: 'lose_weight', kcalTarget: 1800 }, confidence: 0.9,
      derivedFrom: [], computedAt: new Date(), validUntil: new Date(Date.now() + 86400000),
    }];
    const lines = buildMemoryHighlights('user-1', facts);
    expect(lines[0]).toContain('lose_weight');
  });

  it('empty facts -> empty array without calling the assembler', () => {
    expect(buildMemoryHighlights('user-1', [])).toEqual([]);
  });
});

describe('buildPersonalizationBlock', () => {
  it('produces a text block covering profile, targets, allergens, conditions, and memory', () => {
    const block = buildPersonalizationBlock({
      profile: makeProfile({ conditions: ['diabetes'], allergens: ['peanut'] }),
    });
    expect(block.text).toContain('30-year-old female');
    expect(block.text).toContain('Daily targets');
    expect(block.text).toContain('Declared allergens');
    expect(block.text).toContain('peanut');
    expect(block.text).toContain('Diabetes');
  });

  it('omits targets/allergens/conditions lines entirely when there is nothing real to say', () => {
    const block = buildPersonalizationBlock({
      profile: makeProfile({ heightCm: null, weightKg: null, allergens: [], conditions: [] }),
    });
    expect(block.text).not.toContain('Daily targets');
    expect(block.text).not.toContain('Declared allergens');
    expect(block.text).not.toContain('Health conditions');
  });
});

describe('buildFollowUpQuestion', () => {
  it('asks about the biggest missing gap first: activity level, then diet type, then body stats', () => {
    expect(buildFollowUpQuestion(makeProfile({ activityLevel: null }), null)).toMatch(/active/i);
    expect(buildFollowUpQuestion(makeProfile({ dietType: null }), null)).toMatch(/vegetarian|vegan/i);
    expect(buildFollowUpQuestion(makeProfile(), null)).toMatch(/height and weight/i);
  });

  it('once the profile is complete, asks about conditions, then budget, then deepens personalization', () => {
    const targets = computeTargets(makeProfile())!;
    expect(buildFollowUpQuestion(makeProfile(), targets)).toMatch(/health conditions/i);
    expect(buildFollowUpQuestion(makeProfile({ conditions: ['diabetes'] }), targets)).toMatch(/budget/i);
    expect(
      buildFollowUpQuestion(makeProfile({ conditions: ['diabetes'], budgetLevel: 'moderate' }), targets),
    ).toMatch(/meal plan|next meal/i);
  });

  it('a reproductive_status on file counts as an answered "conditions" gap even with no chips ticked', () => {
    const targets = computeTargets(makeProfile())!;
    expect(buildFollowUpQuestion(makeProfile({ reproductiveStatus: 'pregnant' }), targets)).not.toMatch(/health conditions/i);
  });
});

describe('Phase 2 — advanced personalization fields', () => {
  it('computeTargets raises the protein target for competitive athletes (ISSN position stand)', () => {
    const general = computeTargets(makeProfile({ athleteStatus: 'none' }))!;
    const endurance = computeTargets(makeProfile({ athleteStatus: 'competitive_endurance' }))!;
    const strength = computeTargets(makeProfile({ athleteStatus: 'competitive_strength' }))!;
    expect(endurance.budget.proteinG).toBeGreaterThan(general.budget.proteinG);
    expect(strength.budget.proteinG).toBeGreaterThan(endurance.budget.proteinG);
  });

  it('athlete protein bump only applies to freshly-derived targets, not a stored goal', () => {
    const goals: UserGoalsOutput = { goal: 'maintain', tdeeKcal: 2200, macroProteinG: 100, macroFatG: 70, macroCarbsG: 250 };
    const t = computeTargets(makeProfile({ athleteStatus: 'competitive_strength' }), goals);
    expect(t!.budget.proteinG).toBe(100); // stored value untouched
  });

  it('buildConditionHighlights surfaces pregnancy/lactation guidance from reproductive_status alone', () => {
    expect(buildConditionHighlights([], 'pregnant').some((h) => h.startsWith('Pregnancy:'))).toBe(true);
    expect(buildConditionHighlights([], 'lactating').some((h) => h.startsWith('Breastfeeding'))).toBe(true);
    // Ticking the 'pregnancy' chip AND setting reproductive_status doesn't duplicate the highlight
    expect(buildConditionHighlights(['pregnancy'], 'pregnant')).toHaveLength(1);
  });

  it('personalization block mentions medications, athlete status, body fat, waist risk, and lifestyle when present', () => {
    const block = buildPersonalizationBlock({
      profile: makeProfile({
        medications: ['levothyroxine 50mcg'],
        athleteStatus: 'competitive_strength',
        bodyFatPct: 18,
        waistCircumferenceCm: 95, // > 88cm WHO threshold for a female profile
        sleepHoursAvg: 5.5,
        stressLevel: 'high',
        mealTimingPattern: 'intermittent_fasting_16_8',
        budgetLevel: 'budget',
      }),
    });
    expect(block.text).toContain('levothyroxine');
    expect(block.text).toContain('competitive strength athlete');
    expect(block.text).toContain('body fat');
    expect(block.text).toContain('waist circumference');
    expect(block.text).toMatch(/5\.5h sleep/);
    expect(block.text).toMatch(/high stress/);
    expect(block.text).toMatch(/16:8/);
    expect(block.text).toContain('budget-conscious');
  });

  it('personalization block stays silent on the new fields entirely when they are unset', () => {
    const block = buildPersonalizationBlock({ profile: makeProfile() });
    expect(block.text).not.toContain('Declared medications');
    expect(block.text).not.toContain('Lifestyle');
    expect(block.text).not.toContain('Grocery budget');
  });
});
