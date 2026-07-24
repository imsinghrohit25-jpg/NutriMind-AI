// Curated meal-suggestion knowledge base for the AI Diet Chat's general-advice path (AI Nutrition
// Intelligence upgrade). Deterministic and static — like engines/disease/guidance.ts, this lists
// real, named foods and WHY they fit a goal; it never invents a nutrition NUMBER (that's still
// exclusively engines/score + nutrition.compute's job). Covers the most common real query
// pattern this app sees ("what should I eat for X to get more Y") with diet-type-aware,
// allergen-filtered, multi-variant (quick / meal-prep / budget / regional) suggestions.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type NutritionGoal = 'high_protein' | 'weight_loss' | 'muscle_gain' | 'general';
export type SuggestionDietType = 'vegetarian' | 'vegan' | 'non_vegetarian' | 'eggetarian' | 'jain' | 'other';
export type SuggestionTag = 'quick' | 'meal_prep' | 'budget' | 'premium' | 'regional_indian' | 'international';

export interface MealSuggestion {
  name: string;
  dietTypes: SuggestionDietType[];
  /** Allergen taxonomy keys this dish typically contains — used to filter out anything matching
   *  the user's declared allergens (engines/allergen/taxonomy.ts keys, kept as plain strings here
   *  to avoid a hard dependency on that module's exact export shape). */
  allergenTags: string[];
  tags: SuggestionTag[];
  why: string;
}

const BREAKFAST: MealSuggestion[] = [
  { name: 'high-protein moong dal chilla with mint chutney', dietTypes: ['vegetarian', 'vegan', 'eggetarian', 'jain', 'other'],
    allergenTags: [], tags: ['quick', 'regional_indian', 'budget'],
    why: 'lentil batter is naturally high in protein and fiber, keeping you full without refined flour' },
  { name: 'Greek yogurt with nuts, seeds, and berries', dietTypes: ['vegetarian', 'eggetarian', 'other'],
    allergenTags: ['tree_nuts', 'milk'], tags: ['quick', 'international'],
    why: 'Greek yogurt has roughly double the protein of regular yogurt for the same volume' },
  { name: 'masala egg bhurji with multigrain roti', dietTypes: ['eggetarian', 'non_vegetarian', 'other'],
    allergenTags: ['egg', 'gluten'], tags: ['quick', 'regional_indian'],
    why: 'eggs are a complete protein source and cook in under 5 minutes' },
  { name: 'besan (chickpea flour) chilla with vegetables', dietTypes: ['vegetarian', 'vegan', 'jain', 'eggetarian', 'other'],
    allergenTags: [], tags: ['quick', 'budget', 'regional_indian'],
    why: 'chickpea flour is protein- and fiber-rich and needs no refrigeration prep' },
  { name: 'overnight oats with peanut butter and banana', dietTypes: ['vegetarian', 'vegan', 'eggetarian', 'other'],
    allergenTags: ['peanut'], tags: ['meal_prep', 'budget', 'international'],
    why: 'prepped the night before, oats provide slow-digesting carbs and peanut butter adds protein and healthy fat' },
  { name: 'sprouted moong salad with lemon', dietTypes: ['vegetarian', 'vegan', 'jain', 'eggetarian', 'other'],
    allergenTags: [], tags: ['quick', 'budget', 'regional_indian'],
    why: 'sprouting increases available protein and vitamin C without any cooking needed' },
  { name: 'paneer bhurji with roti', dietTypes: ['vegetarian', 'eggetarian', 'other'],
    allergenTags: ['milk', 'gluten'], tags: ['regional_indian'],
    why: 'paneer is a dense, easy-to-digest protein source popular across Indian cuisine' },
  { name: 'protein smoothie (soy/pea milk, banana, oats)', dietTypes: ['vegan', 'vegetarian', 'eggetarian', 'other'],
    allergenTags: ['soy'], tags: ['quick', 'international'],
    why: 'a blended plant-protein smoothie is fast for busy mornings and easy to scale up in protein content' },
];

const LUNCH: MealSuggestion[] = [
  { name: 'dal, brown rice, and mixed vegetable sabzi', dietTypes: ['vegetarian', 'vegan', 'jain', 'eggetarian', 'other'],
    allergenTags: [], tags: ['budget', 'regional_indian', 'meal_prep'],
    why: 'combining a lentil (dal) with grain gives a complete amino acid profile, and it reheats well' },
  { name: 'grilled chicken or fish with quinoa and salad', dietTypes: ['non_vegetarian', 'other'],
    allergenTags: ['fish'], tags: ['premium', 'international'],
    why: 'lean grilled protein plus a whole grain supports muscle repair with controlled fat' },
  { name: 'rajma chawal (kidney beans and rice)', dietTypes: ['vegetarian', 'vegan', 'eggetarian', 'other'],
    allergenTags: [], tags: ['budget', 'regional_indian', 'meal_prep'],
    why: 'a classic North Indian combination that is fiber- and protein-rich and cooks in batches well' },
  { name: 'chickpea and vegetable Buddha bowl', dietTypes: ['vegetarian', 'vegan', 'eggetarian', 'other'],
    allergenTags: [], tags: ['meal_prep', 'international'],
    why: 'chickpeas add plant protein and fiber; a bowl format is easy to portion and pack ahead' },
  { name: 'tofu and vegetable stir-fry with brown rice', dietTypes: ['vegan', 'vegetarian', 'eggetarian', 'other'],
    allergenTags: ['soy'], tags: ['quick', 'international'],
    why: 'tofu is a complete plant protein and stir-frying keeps prep time short' },
];

const DINNER: MealSuggestion[] = [
  { name: 'dal tadka with phulka and sautéed greens', dietTypes: ['vegetarian', 'vegan', 'jain', 'eggetarian', 'other'],
    allergenTags: [], tags: ['budget', 'regional_indian'],
    why: 'a lighter, fiber-forward dinner supports digestion before sleep and still meets protein needs' },
  { name: 'grilled fish or paneer tikka with a large salad', dietTypes: ['non_vegetarian', 'vegetarian', 'other'],
    allergenTags: ['fish', 'milk'], tags: ['premium'],
    why: 'a high-protein, moderate-carb dinner is a common pattern for weight-management and muscle-retention goals' },
  { name: 'vegetable and lentil soup with whole-grain bread', dietTypes: ['vegetarian', 'vegan', 'eggetarian', 'other'],
    allergenTags: ['gluten'], tags: ['meal_prep', 'international'],
    why: 'a warm, high-volume, lower-energy-density meal that is easy to batch-cook for the week' },
  { name: 'khichdi with ghee and curd', dietTypes: ['vegetarian', 'eggetarian', 'other'],
    allergenTags: ['milk'], tags: ['quick', 'regional_indian', 'budget'],
    why: 'a traditional, easily-digestible one-pot dinner that balances protein and carbs' },
];

const SNACK: MealSuggestion[] = [
  { name: 'roasted chana (chickpeas)', dietTypes: ['vegetarian', 'vegan', 'jain', 'eggetarian', 'other'],
    allergenTags: [], tags: ['budget', 'regional_indian', 'quick'],
    why: 'a crunchy, high-fiber, protein-containing snack that travels well without refrigeration' },
  { name: 'boiled eggs', dietTypes: ['eggetarian', 'non_vegetarian', 'other'],
    allergenTags: ['egg'], tags: ['quick', 'budget', 'meal_prep'],
    why: 'boil a batch ahead for a fast, complete-protein snack with minimal prep' },
  { name: 'Greek yogurt with a handful of nuts', dietTypes: ['vegetarian', 'eggetarian', 'other'],
    allergenTags: ['milk', 'tree_nuts'], tags: ['quick'],
    why: 'pairs protein with healthy fats for satiety between meals' },
  { name: 'fruit chaat with sprouts', dietTypes: ['vegetarian', 'vegan', 'jain', 'eggetarian', 'other'],
    allergenTags: [], tags: ['budget', 'regional_indian', 'quick'],
    why: 'adds fiber and vitamin C alongside plant protein from the sprouts' },
];

const TABLE: Record<MealType, MealSuggestion[]> = {
  breakfast: BREAKFAST, lunch: LUNCH, dinner: DINNER, snack: SNACK,
};

const GOAL_FRAMING: Record<NutritionGoal, string> = {
  high_protein: 'to help you hit a higher protein target',
  weight_loss: 'to keep you full on fewer calories while preserving muscle',
  muscle_gain: 'to support muscle repair and growth alongside training',
  general: 'for balanced, everyday nutrition',
};

/** Very small, real (not invented) intent detection — matches this codebase's existing
 *  extractFoodQuery discipline in specialists/nutrition.ts: better to default to 'general' than
 *  guess a goal the user didn't say. */
export function detectMealType(message: string): MealType | null {
  const m = message.toLowerCase();
  if (/\bbreakfast\b/.test(m)) return 'breakfast';
  if (/\blunch\b/.test(m)) return 'lunch';
  if (/\bdinner\b|\bsupper\b/.test(m)) return 'dinner';
  if (/\bsnack\b/.test(m)) return 'snack';
  return null;
}

export function detectGoal(message: string): NutritionGoal {
  const m = message.toLowerCase();
  if (/\bprotein\b/.test(m)) return 'high_protein';
  if (/\b(lose|loss|cutting|deficit|fat loss)\b/.test(m)) return 'weight_loss';
  if (/\b(muscle|bulk|gain|bulking)\b/.test(m)) return 'muscle_gain';
  return 'general';
}

/** Diet-type + allergen-filtered, tag-diverse selection — picks up to `count` suggestions,
 *  preferring to cover distinct tags (so the reply naturally offers a quick option, a budget
 *  option, a meal-prep option, etc. rather than four near-duplicates) per the mission's
 *  requirement for budget/premium/quick/meal-prep/regional variety. */
export function selectMealSuggestions(opts: {
  mealType: MealType | null;
  dietType: SuggestionDietType | null;
  allergens: string[];
  count?: number;
  /** Self-reported grocery budget (migration 0036) — when 'budget' or 'premium', eligible dishes
   *  carrying the matching tag are moved to the front before tag-diversity picking runs, so a
   *  budget-conscious user's suggestions actually skew that way instead of just including one
   *  budget option among four. 'moderate' or omitted leaves the original diverse-by-default order. */
  budgetLevel?: string | null;
}): MealSuggestion[] {
  const { mealType, dietType, allergens, count = 4, budgetLevel } = opts;
  const pool = mealType ? TABLE[mealType] : [...BREAKFAST, ...LUNCH, ...DINNER].slice(0, 12);

  let eligible = pool.filter((s) => {
    if (dietType && !s.dietTypes.includes(dietType)) return false;
    if (allergens.some((a) => s.allergenTags.includes(a))) return false;
    return true;
  });

  if (budgetLevel === 'budget' || budgetLevel === 'premium') {
    const preferred = eligible.filter((s) => s.tags.includes(budgetLevel as SuggestionTag));
    const rest = eligible.filter((s) => !s.tags.includes(budgetLevel as SuggestionTag));
    eligible = [...preferred, ...rest];
  }

  const picked: MealSuggestion[] = [];
  const seenTags = new Set<SuggestionTag>();
  for (const s of eligible) {
    const isNewTagCombo = s.tags.some((t) => !seenTags.has(t));
    if (picked.length < count && (isNewTagCombo || picked.length < 2)) {
      picked.push(s);
      s.tags.forEach((t) => seenTags.add(t));
    }
    if (picked.length >= count) break;
  }
  // Fill up to count with any remaining eligible items if tag-diversity picking fell short.
  for (const s of eligible) {
    if (picked.length >= count) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked;
}

export function renderSuggestions(suggestions: MealSuggestion[], goal: NutritionGoal): string {
  return suggestions
    .map((s) => `${s.name} (${s.tags.join(', ')}) — ${s.why}, ${GOAL_FRAMING[goal]}.`)
    .join('\n');
}
