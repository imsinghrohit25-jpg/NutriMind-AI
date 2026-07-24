// Daily nutrition budgets derived from TDEE and profile.
// Source: ICMR-NIN RDA 2020; WHO guidelines; FSSAI Labelling Regulations 2022.
// These budgets are used to compute remaining-budget values per meal scan.

import type { UserProfile, EnergyTarget } from './targets.js';

export interface DailyBudget {
  energyKcal:     number;  // = TDEE
  proteinG:       number;  // ICMR-NIN: 0.83g/kg body weight
  fatTotalG:      number;  // 20-35% of calories (default 30%) / 9 kcal per g
  fatSaturatedG:  number;  // < 10% of energy / 9 kcal per g
  fatTransG:      number;  // WHO: < 1% of energy → < 2.2g for 2000 kcal
  carbohydratesG: number;  // 55% of calories / 4 kcal per g
  sugarsAddedG:   number;  // WHO: < 10% of calories (free sugars) / 4 kcal per g
  sodiumMg:       number;  // WHO: < 2000 mg/day (< 5g salt)
  dietaryFiberG:  number;  // ICMR-NIN: 25-38g/day; use 30g as practical target
}

export interface BudgetRemaining {
  budget: DailyBudget;
  consumed: Partial<DailyBudget>;
  remaining: DailyBudget;
}

export interface BudgetOptions {
  /** g protein per kg body weight — overrides the ICMR-NIN general-population default of
   *  0.83g/kg. Athlete-aware callers (agents/personalization-context.ts) pass a higher value per
   *  the ISSN Position Stand: Protein and Exercise (2017) ranges — endurance ~1.2-1.4g/kg,
   *  strength/power ~1.6-2.0g/kg. Left undefined for the general population. */
  proteinGPerKg?: number;
}

export function computeDailyBudget(
  profile: UserProfile,
  energy: EnergyTarget,
  opts: BudgetOptions = {},
): DailyBudget {
  const tdee = energy.tdeeKcal;
  const proteinGPerKg = opts.proteinGPerKg ?? 0.83;

  return {
    energyKcal:     tdee,
    proteinG:       Math.round(profile.weightKg * proteinGPerKg),
    fatTotalG:      Math.round((tdee * 0.30) / 9),            // 30% of energy
    fatSaturatedG:  Math.round((tdee * 0.10) / 9),            // < 10% of energy
    fatTransG:      Math.round((tdee * 0.01) / 9),            // < 1% of energy
    carbohydratesG: Math.round((tdee * 0.55) / 4),            // 55% of energy
    sugarsAddedG:   Math.round((tdee * 0.10) / 4),            // < 10% of energy (free sugars)
    sodiumMg:       2000,                                      // WHO <2000 mg/day
    dietaryFiberG:  30,                                        // ICMR-NIN practical target
  };
}

export function computeRemaining(
  budget: DailyBudget,
  consumed: Partial<DailyBudget>,
): BudgetRemaining {
  const remaining: DailyBudget = {
    energyKcal:     Math.max(0, budget.energyKcal     - (consumed.energyKcal     ?? 0)),
    proteinG:       Math.max(0, budget.proteinG       - (consumed.proteinG       ?? 0)),
    fatTotalG:      Math.max(0, budget.fatTotalG      - (consumed.fatTotalG      ?? 0)),
    fatSaturatedG:  Math.max(0, budget.fatSaturatedG  - (consumed.fatSaturatedG  ?? 0)),
    fatTransG:      Math.max(0, budget.fatTransG      - (consumed.fatTransG      ?? 0)),
    carbohydratesG: Math.max(0, budget.carbohydratesG - (consumed.carbohydratesG ?? 0)),
    sugarsAddedG:   Math.max(0, budget.sugarsAddedG   - (consumed.sugarsAddedG   ?? 0)),
    sodiumMg:       Math.max(0, budget.sodiumMg       - (consumed.sodiumMg       ?? 0)),
    dietaryFiberG:  Math.max(0, budget.dietaryFiberG  - (consumed.dietaryFiberG  ?? 0)),
  };

  return { budget, consumed, remaining };
}
