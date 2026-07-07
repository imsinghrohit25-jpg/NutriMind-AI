// Daily meal aggregator — pure function, no side effects.
// Sums all meal entries for a day into a single nutrition total.
// Gate requirement: hand-verified day aggregation.

export interface MealEntry {
  mealId:       string;
  productName:  string;
  servingG:     number;   // grams consumed (user-adjusted portion)
  nutrition:    NutritionPer100g;
  loggedAt:     string;   // ISO timestamp
}

export interface NutritionPer100g {
  energyKcal?:    number | null;
  proteinG?:      number | null;
  fatTotalG?:     number | null;
  fatSaturatedG?: number | null;
  fatTransG?:     number | null;
  carbohydratesG?:number | null;
  sugarsG?:       number | null;
  sugarsAddedG?:  number | null;
  dietaryFiberG?: number | null;
  sodiumMg?:      number | null;
}

export interface DailyNutritionTotal {
  date:              string;
  entryCount:        number;
  energyKcal:        number;
  proteinG:          number;
  fatTotalG:         number;
  fatSaturatedG:     number;
  fatTransG:         number;
  carbohydratesG:    number;
  sugarsG:           number;
  sugarsAddedG:      number;
  sugarsAddedIsEstimated: boolean;
  dietaryFiberG:     number;
  sodiumMg:          number;
}

export function aggregateDay(
  entries: MealEntry[],
  date: string,
): DailyNutritionTotal {
  const total: DailyNutritionTotal = {
    date,
    entryCount:             entries.length,
    energyKcal:             0,
    proteinG:               0,
    fatTotalG:              0,
    fatSaturatedG:          0,
    fatTransG:              0,
    carbohydratesG:         0,
    sugarsG:                0,
    sugarsAddedG:           0,
    sugarsAddedIsEstimated: false,
    dietaryFiberG:          0,
    sodiumMg:               0,
  };

  for (const entry of entries) {
    const factor = entry.servingG / 100;  // convert per-100g to per-serving
    const n = entry.nutrition;

    total.energyKcal     += (n.energyKcal     ?? 0) * factor;
    total.proteinG        += (n.proteinG       ?? 0) * factor;
    total.fatTotalG       += (n.fatTotalG      ?? 0) * factor;
    total.fatSaturatedG   += (n.fatSaturatedG  ?? 0) * factor;
    total.fatTransG       += (n.fatTransG      ?? 0) * factor;
    total.carbohydratesG  += (n.carbohydratesG ?? 0) * factor;
    total.sugarsG         += (n.sugarsG        ?? 0) * factor;
    total.sugarsAddedG    += (n.sugarsAddedG   ?? 0) * factor;
    total.dietaryFiberG   += (n.dietaryFiberG  ?? 0) * factor;
    total.sodiumMg        += (n.sodiumMg       ?? 0) * factor;
  }

  // Round to 1 decimal for display
  total.energyKcal    = round1(total.energyKcal);
  total.proteinG       = round1(total.proteinG);
  total.fatTotalG      = round1(total.fatTotalG);
  total.fatSaturatedG  = round1(total.fatSaturatedG);
  total.fatTransG      = round1(total.fatTransG);
  total.carbohydratesG = round1(total.carbohydratesG);
  total.sugarsG        = round1(total.sugarsG);
  total.sugarsAddedG   = round1(total.sugarsAddedG);
  total.dietaryFiberG  = round1(total.dietaryFiberG);
  total.sodiumMg       = Math.round(total.sodiumMg);

  return total;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
