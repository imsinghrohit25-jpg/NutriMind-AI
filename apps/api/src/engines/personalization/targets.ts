// Mifflin-St Jeor BMR + TDEE — pure function, no side effects.
// Source: Mifflin MD et al. 1990; ICMR-NIN RDA 2020 for Indian population context.

export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activityLevel: ActivityLevel;
}

export interface EnergyTarget {
  bmrKcal: number;       // Basal Metabolic Rate
  tdeeKcal: number;      // Total Daily Energy Expenditure
  activityFactor: number;
  formula: 'mifflin_st_jeor';
}

// Activity factors from Mifflin-St Jeor 1990 / ICMR-NIN 2020
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary:   1.2,    // desk job, little exercise
  light:       1.375,  // light exercise 1–3 days/week
  moderate:    1.55,   // moderate exercise 3–5 days/week
  active:      1.725,  // hard exercise 6–7 days/week
  very_active: 1.9,    // physical labour or twice-daily training
};

export function computeEnergyTarget(profile: UserProfile): EnergyTarget {
  const { weightKg, heightCm, ageYears, sex, activityLevel } = profile;

  // Mifflin-St Jeor BMR
  let bmrKcal: number;
  if (sex === 'female') {
    bmrKcal = 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  } else {
    // male and other both use male formula as conservative default
    bmrKcal = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  }

  const activityFactor = ACTIVITY_FACTORS[activityLevel];
  const tdeeKcal = Math.round(bmrKcal * activityFactor);

  return {
    bmrKcal: Math.round(bmrKcal),
    tdeeKcal,
    activityFactor,
    formula: 'mifflin_st_jeor',
  };
}
