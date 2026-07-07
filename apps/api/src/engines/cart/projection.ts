// Cart nutritional projection — pure function.
// Projects the weekly/daily nutritional impact of a shopping cart given usage frequency.
// Helps users understand how their typical grocery basket shapes their diet.

import type { NutritionPer100g } from '../meals/aggregate.js';

export interface CartItemProjection {
  productId:        string;
  productName:      string;
  servingG:         number;       // typical serving size in grams
  timesPerWeek:     number;       // how often this product is consumed weekly
  nutritionPer100g: NutritionPer100g;
}

export interface ProjectedWeeklyNutrition {
  energyKcalPerDay:    number;
  proteinGPerDay:      number;
  fatTotalGPerDay:     number;
  fatSaturatedGPerDay: number;
  carbohydratesGPerDay:number;
  sugarsGPerDay:       number;
  sodiumMgPerDay:      number;
  dietaryFiberGPerDay: number;
  itemContributions:   ItemContribution[];
}

export interface ItemContribution {
  productId:      string;
  productName:    string;
  energyKcalPerDay: number;
  sodiumMgPerDay:   number;
  pctOfTotalCalories: number;
}

export function projectCart(
  items: CartItemProjection[],
): ProjectedWeeklyNutrition {
  const perDay = {
    energyKcal:    0,
    proteinG:      0,
    fatTotalG:     0,
    fatSaturatedG: 0,
    carbohydratesG:0,
    sugarsG:       0,
    sodiumMg:      0,
    dietaryFiberG: 0,
  };

  const itemContributions: ItemContribution[] = [];

  for (const item of items) {
    const servingFactor  = item.servingG / 100;
    const weeklyFactor   = item.timesPerWeek / 7;  // per week → per day
    const n = item.nutritionPer100g;

    const dailyEnergy = (n.energyKcal ?? 0) * servingFactor * weeklyFactor;
    const dailySodium = (n.sodiumMg   ?? 0) * servingFactor * weeklyFactor;

    perDay.energyKcal    += dailyEnergy;
    perDay.proteinG       += (n.proteinG       ?? 0) * servingFactor * weeklyFactor;
    perDay.fatTotalG      += (n.fatTotalG      ?? 0) * servingFactor * weeklyFactor;
    perDay.fatSaturatedG  += (n.fatSaturatedG  ?? 0) * servingFactor * weeklyFactor;
    perDay.carbohydratesG += (n.carbohydratesG ?? 0) * servingFactor * weeklyFactor;
    perDay.sugarsG        += (n.sugarsG        ?? 0) * servingFactor * weeklyFactor;
    perDay.sodiumMg       += dailySodium;
    perDay.dietaryFiberG  += (n.dietaryFiberG  ?? 0) * servingFactor * weeklyFactor;

    itemContributions.push({
      productId:          item.productId,
      productName:        item.productName,
      energyKcalPerDay:   Math.round(dailyEnergy * 10) / 10,
      sodiumMgPerDay:     Math.round(dailySodium),
      pctOfTotalCalories: 0,  // filled in below after totalisation
    });
  }

  // Fill % of total calories
  const totalCalories = perDay.energyKcal;
  for (const c of itemContributions) {
    c.pctOfTotalCalories = totalCalories > 0
      ? Math.round((c.energyKcalPerDay / totalCalories) * 1000) / 10
      : 0;
  }

  return {
    energyKcalPerDay:     Math.round(perDay.energyKcal * 10) / 10,
    proteinGPerDay:       Math.round(perDay.proteinG * 10) / 10,
    fatTotalGPerDay:      Math.round(perDay.fatTotalG * 10) / 10,
    fatSaturatedGPerDay:  Math.round(perDay.fatSaturatedG * 10) / 10,
    carbohydratesGPerDay: Math.round(perDay.carbohydratesG * 10) / 10,
    sugarsGPerDay:        Math.round(perDay.sugarsG * 10) / 10,
    sodiumMgPerDay:       Math.round(perDay.sodiumMg),
    dietaryFiberGPerDay:  Math.round(perDay.dietaryFiberG * 10) / 10,
    itemContributions,
  };
}
