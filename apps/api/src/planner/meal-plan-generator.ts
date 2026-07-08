// 30-day meal plan generator.
// Generates a full week (or month) of meals using the recipe generator.
// Applies constraint validation before finalizing the plan.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';
import { generateRecipe } from '../restaurant/recipe-generator.js';
import type { DietType } from '../restaurant/recipe-generator.js';

export interface MealPlanConstraints {
  kcalTarget:     number;
  proteinTarget:  number;   // g/day
  dietType:       DietType;
  allergens:      string[];
  durationDays:   number;   // 7 or 30
  cuisineRotation?: string[]; // e.g. ['north-indian', 'south-indian', 'generic']
}

export interface DayPlan {
  date:      string;  // YYYY-MM-DD
  breakfast: PlannedMeal;
  lunch:     PlannedMeal;
  dinner:    PlannedMeal;
  snack?:    PlannedMeal;
  totalKcal: number;
  totalProtein: number;
}

export interface PlannedMeal {
  recipeName:  string;
  recipeData:  object;
  kcalEstimate:number;
  proteinG:    number;
  mealType:    'breakfast' | 'lunch' | 'dinner' | 'snack';
}

// Typical meal kcal distribution
const MEAL_DISTRIBUTION = {
  breakfast: 0.25,
  lunch:     0.35,
  dinner:    0.30,
  snack:     0.10,
};

// Rotating recipe prompts per meal type — ensures variety
const BREAKFAST_PROMPTS = [
  'high-protein idli sambar',
  'poha with vegetables',
  'besan chilla with mint chutney',
  'upma with peanuts',
  'moong dal cheela',
  'oats dalia khichdi',
  'multigrain roti with curd',
];

const LUNCH_PROMPTS = [
  'dal chawal with vegetable sabzi',
  'rajma chawal with salad',
  'chole roti with raita',
  'mixed veg biryani',
  'palak paneer with roti',
  'methi thepla with kadhi',
  'sambar rice with papad',
];

const DINNER_PROMPTS = [
  'dal tadka with phulka',
  'paneer bhurji with roti',
  'vegetable soup with bread',
  'khichdi with ghee',
  'moong dal with roti',
  'vegetable curry with rice',
  'lentil soup with whole wheat bread',
];

const SNACK_PROMPTS = [
  'sprouts chaat',
  'roasted makhana',
  'fruit chaat',
  'dhokla',
  'boiled chana chaat',
];

function getPrompt(prompts: string[], dayIndex: number): string {
  return prompts[dayIndex % prompts.length] ?? prompts[0] ?? 'balanced Indian meal';
}

/** Generate a single meal using the recipe generator. */
async function generateMeal(opts: {
  mealType:  'breakfast' | 'lunch' | 'dinner' | 'snack';
  dayIndex:  number;
  kcalTarget:number;
  constraints: MealPlanConstraints;
  gateway:   GatewayRouter;
  supabase:  SupabaseClient;
}): Promise<PlannedMeal> {
  const { mealType, dayIndex, kcalTarget, constraints, gateway, supabase } = opts;
  const kcal = Math.round(kcalTarget * MEAL_DISTRIBUTION[mealType]);

  const prompts = {
    breakfast: BREAKFAST_PROMPTS,
    lunch:     LUNCH_PROMPTS,
    dinner:    DINNER_PROMPTS,
    snack:     SNACK_PROMPTS,
  }[mealType];

  const prompt = getPrompt(prompts, dayIndex);

  try {
    const recipe = await generateRecipe({
      prompt:    `${prompt} (approx ${kcal} kcal)`,
      servings:  1,
      dietType:  constraints.dietType,
      allergens: constraints.allergens,
      maxKcal:   Math.round(kcal * 1.2), // 20% tolerance
      gateway,
      supabase,
    });

    return {
      recipeName:   recipe.name,
      recipeData:   recipe,
      kcalEstimate: recipe.perServingNutrition.calories,
      proteinG:     recipe.perServingNutrition.protein,
      mealType,
    };
  } catch {
    // Fallback to a simple meal if generation fails
    return {
      recipeName:   prompt,
      recipeData:   {},
      kcalEstimate: kcal,
      proteinG:     0,
      mealType,
    };
  }
}

/** Validate that a day plan meets nutritional constraints. */
export function validateDayPlan(plan: DayPlan, constraints: MealPlanConstraints): string[] {
  const warnings: string[] = [];
  const kcalTolerance = 0.20; // 20% variance allowed

  if (plan.totalKcal < constraints.kcalTarget * (1 - kcalTolerance)) {
    warnings.push(`Day ${plan.date}: total kcal ${plan.totalKcal} is below target ${constraints.kcalTarget} by more than 20%`);
  }
  if (plan.totalKcal > constraints.kcalTarget * (1 + kcalTolerance)) {
    warnings.push(`Day ${plan.date}: total kcal ${plan.totalKcal} exceeds target ${constraints.kcalTarget} by more than 20%`);
  }
  if (constraints.proteinTarget > 0 && plan.totalProtein < constraints.proteinTarget * 0.8) {
    warnings.push(`Day ${plan.date}: protein ${plan.totalProtein}g is below target ${constraints.proteinTarget}g`);
  }

  return warnings;
}

/** Generate a full meal plan and persist to database. */
export async function generateAndSaveMealPlan(opts: {
  userId:      string;
  title:       string;
  startDate:   string;   // YYYY-MM-DD
  constraints: MealPlanConstraints;
  gateway:     GatewayRouter;
  supabase:    SupabaseClient;
}): Promise<{ planId: string; days: DayPlan[]; warnings: string[] }> {
  const { userId, title, startDate, constraints, gateway, supabase } = opts;

  const { data: plan, error: planErr } = await supabase
    .from('meal_plans')
    .insert({
      user_id:     userId,
      title,
      start_date:  startDate,
      end_date:    new Date(
        new Date(startDate).getTime() + (constraints.durationDays - 1) * 86400000,
      ).toISOString().slice(0, 10),
      diet_type:   constraints.dietType,
      kcal_target: constraints.kcalTarget,
      status:      'draft',
      generated_by:'ai',
    })
    .select('id')
    .single();

  if (planErr || !plan) throw new Error(`Failed to create meal plan: ${planErr?.message}`);
  const planId = plan.id as string;

  const days: DayPlan[] = [];
  const allWarnings: string[] = [];

  for (let d = 0; d < constraints.durationDays; d++) {
    const date = new Date(new Date(startDate).getTime() + d * 86400000)
      .toISOString().slice(0, 10);

    const [breakfast, lunch, dinner, snack] = await Promise.all([
      generateMeal({ mealType: 'breakfast', dayIndex: d, kcalTarget: constraints.kcalTarget, constraints, gateway, supabase }),
      generateMeal({ mealType: 'lunch',     dayIndex: d, kcalTarget: constraints.kcalTarget, constraints, gateway, supabase }),
      generateMeal({ mealType: 'dinner',    dayIndex: d, kcalTarget: constraints.kcalTarget, constraints, gateway, supabase }),
      generateMeal({ mealType: 'snack',     dayIndex: d, kcalTarget: constraints.kcalTarget, constraints, gateway, supabase }),
    ]);

    const day: DayPlan = {
      date, breakfast, lunch, dinner, snack,
      totalKcal:    breakfast.kcalEstimate + lunch.kcalEstimate + dinner.kcalEstimate + snack.kcalEstimate,
      totalProtein: breakfast.proteinG     + lunch.proteinG     + dinner.proteinG     + snack.proteinG,
    };

    const warnings = validateDayPlan(day, constraints);
    allWarnings.push(...warnings);
    days.push(day);

    // Persist each meal
    await supabase.from('meal_plan_items').insert([
      { meal_plan_id: planId, user_id: userId, plan_date: date, meal_type: 'breakfast', recipe_name: breakfast.recipeName, recipe_data: breakfast.recipeData, kcal_estimate: breakfast.kcalEstimate, protein_g: breakfast.proteinG },
      { meal_plan_id: planId, user_id: userId, plan_date: date, meal_type: 'lunch',     recipe_name: lunch.recipeName,     recipe_data: lunch.recipeData,     kcal_estimate: lunch.kcalEstimate,     protein_g: lunch.proteinG },
      { meal_plan_id: planId, user_id: userId, plan_date: date, meal_type: 'dinner',    recipe_name: dinner.recipeName,    recipe_data: dinner.recipeData,    kcal_estimate: dinner.kcalEstimate,    protein_g: dinner.proteinG },
      { meal_plan_id: planId, user_id: userId, plan_date: date, meal_type: 'snack',     recipe_name: snack.recipeName,     recipe_data: snack.recipeData,     kcal_estimate: snack.kcalEstimate,     protein_g: snack.proteinG },
    ]);
  }

  // Mark plan as active
  await supabase.from('meal_plans').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', planId);

  return { planId, days, warnings: allWarnings };
}
