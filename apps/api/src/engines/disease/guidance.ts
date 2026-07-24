// Per-condition dietary guidance content — deterministic, cited, no LLM.
// Served by GET /v1/disease/guidance for the user's stored conditions.
// Output-policy: informational language only ("may support", "commonly recommended"),
// never diagnosis or cure claims; every entry carries citationIds from citations.ts.
// Food examples deliberately favour items present in IFCT 2017 / common Indian kitchens,
// with international staples alongside — matching the app's user base.

export interface ConditionGuidance {
  condition: string;
  label: string;
  summary: string;
  safeFoods: string[];      // "generally good choices" — not an exhaustive whitelist
  avoidFoods: string[];     // "commonly recommended to limit or avoid"
  recommendations: string[];
  warnings: string[];
  citationIds: string[];
}

export const CONDITION_GUIDANCE: Record<string, ConditionGuidance> = {
  diabetes: {
    condition: 'diabetes',
    label: 'Diabetes',
    summary:
      'Managing blood glucose is easier with low-glycaemic, high-fiber foods, consistent meal timing, and limited free sugars.',
    safeFoods: [
      'Whole pulses and dals (moong, masoor, chana)', 'Whole grains (brown rice, whole wheat roti, millets like ragi and bajra)',
      'Non-starchy vegetables (leafy greens, gourds, okra, cauliflower)', 'Nuts and seeds (unsweetened)',
      'Paneer, curd, and unsweetened dairy', 'Eggs, fish, and lean poultry',
    ],
    avoidFoods: [
      'Sugar-sweetened drinks and fruit juices', 'Sweets, mithai, and desserts with added sugar',
      'Refined flour (maida) products — white bread, biscuits, bakery items', 'Deep-fried snacks',
      'Sweetened breakfast cereals', 'Honey/jaggery in significant amounts (still free sugars)',
    ],
    recommendations: [
      'Prefer whole grains and millets over refined flour; fiber slows glucose absorption.',
      'Pair carbohydrates with protein or fat to blunt glucose spikes.',
      'Keep free sugars under 10% of daily energy (WHO); under 5% is better still.',
      'Space carbohydrates evenly across meals rather than one large load.',
    ],
    warnings: [
      'If you take insulin or sulfonylureas, large changes in carbohydrate intake can cause hypoglycaemia — coordinate diet changes with your care team.',
    ],
    citationIds: ['icmr-diabetes-2018', 'who-sugar-2015', 'icmr-nin-2020'],
  },
  hypertension: {
    condition: 'hypertension',
    label: 'Hypertension (High Blood Pressure)',
    summary:
      'Sodium reduction has the strongest evidence for lowering blood pressure; potassium-rich whole foods help too.',
    safeFoods: [
      'Fresh fruits and vegetables (bananas, citrus, leafy greens — potassium-rich)',
      'Unsalted nuts and seeds', 'Whole pulses and dals cooked with minimal salt',
      'Curd/yogurt and low-fat dairy', 'Fresh fish and lean meats (not cured or processed)',
    ],
    avoidFoods: [
      'Pickles, papad, and salted preserves', 'Namkeen, chips, and salted snacks',
      'Processed and cured meats', 'Instant noodles and packet soups (very high sodium)',
      'Sauces and condiments high in salt (soy sauce, ketchup)', 'Salted butter and cheese in excess',
    ],
    recommendations: [
      'Keep total sodium under 2000 mg/day (about 5 g salt) — WHO recommendation.',
      'Cook with measured salt rather than salting at the table.',
      'Choose potassium-rich foods (fruit, vegetables, pulses) unless your doctor has restricted potassium.',
      'Check labels: anything over 300 mg sodium per 100 g is a high-sodium product.',
    ],
    warnings: [
      'If you also have kidney disease, do not increase potassium-rich foods without medical advice.',
    ],
    citationIds: ['who-sodium-2023', 'who-hypertension-2021', 'icmr-nin-2020'],
  },
  high_cholesterol: {
    condition: 'high_cholesterol',
    label: 'High Cholesterol',
    summary:
      'Replacing saturated and trans fats with unsaturated fats, plus more soluble fiber, supports healthier lipid levels.',
    safeFoods: [
      'Oats, barley, and millets (soluble fiber)', 'Pulses and legumes',
      'Nuts (almonds, walnuts) in moderate portions', 'Fatty fish (omega-3s)',
      'Vegetable oils high in unsaturated fat (mustard, groundnut, olive) in moderation',
      'Fruits and vegetables',
    ],
    avoidFoods: [
      'Vanaspati/hydrogenated fats and anything with partially hydrogenated oil (trans fats)',
      'Deep-fried and repeatedly-fried foods', 'Butter, ghee, and cream in large amounts',
      'Fatty cuts of red meat and organ meats', 'Bakery products made with shortening',
    ],
    recommendations: [
      'Keep saturated fat under 10% of daily energy and eliminate industrial trans fats (WHO).',
      'Swap saturated fats for unsaturated fats rather than for refined carbohydrates.',
      'Add soluble-fiber foods (oats, dals) daily — they actively lower LDL.',
    ],
    warnings: [],
    citationIds: ['who-satfat-2023', 'who-transfat-2023', 'esc-cvd-prevention-2021'],
  },
  heart_disease: {
    condition: 'heart_disease',
    label: 'Heart Disease',
    summary:
      'A pattern low in sodium, saturated fat, and trans fat — and rich in vegetables, pulses, whole grains, and fish — supports cardiovascular health.',
    safeFoods: [
      'Vegetables and fruits at every meal', 'Whole grains and millets',
      'Pulses, dals, and legumes', 'Fish (especially oily fish)',
      'Unsalted nuts and seeds', 'Low-fat dairy',
    ],
    avoidFoods: [
      'Processed and cured meats', 'Deep-fried foods and vanaspati/hydrogenated fats',
      'High-sodium packaged snacks, pickles, and instant foods',
      'Sweets and sugar-sweetened beverages', 'Excess butter, ghee, and cream',
    ],
    recommendations: [
      'Limit sodium to under 2000 mg/day and saturated fat to under 10% of energy.',
      'Avoid trans fats entirely — check labels for hydrogenated oils.',
      'Follow a Mediterranean-style or traditional plant-forward pattern.',
    ],
    warnings: [
      'Diet complements but never replaces prescribed cardiac medication — do not stop medication based on dietary changes.',
    ],
    citationIds: ['esc-cvd-prevention-2021', 'who-sodium-2023', 'who-satfat-2023'],
  },
  kidney_disease: {
    condition: 'kidney_disease',
    label: 'Kidney Disease',
    summary:
      'CKD nutrition is highly stage-dependent: sodium is limited for almost everyone; potassium, phosphorus, and protein limits depend on your stage and dialysis status.',
    safeFoods: [
      'Fresh, home-cooked meals with controlled salt', 'Rice and refined cereals (lower potassium than whole grains — stage-dependent)',
      'Lower-potassium vegetables (bottle gourd, ridge gourd, cabbage) as advised',
      'Apples, papaya, and guava in controlled portions',
    ],
    avoidFoods: [
      'High-sodium foods: pickles, papad, namkeen, processed foods',
      'Salt substitutes (usually potassium chloride — dangerous in CKD)',
      'Very high-potassium foods if restricted: coconut water, bananas, potatoes, tomatoes in excess',
      'Cola drinks (phosphoric acid)', 'Very high-protein diets unless prescribed',
    ],
    recommendations: [
      'Keep sodium under 2300 mg/day (KDOQI).',
      'Get your individual potassium, phosphorus, and protein targets from your nephrology team — they vary by stage.',
      'Prefer fresh foods over packaged; sodium hides in processing.',
    ],
    warnings: [
      'Never use potassium-based salt substitutes with kidney disease.',
      'Protein needs flip between pre-dialysis (often restricted) and dialysis (often increased) — this guidance cannot substitute for your prescribed plan.',
    ],
    citationIds: ['kdoqi-nutrition-ckd-2020', 'who-sodium-2023'],
  },
  fatty_liver: {
    condition: 'fatty_liver',
    label: 'Fatty Liver',
    summary:
      'Weight reduction and cutting added sugars (especially fructose-sweetened drinks) are the best-evidenced dietary levers for NAFLD.',
    safeFoods: [
      'Vegetables, salads, and whole fruits', 'Whole grains and millets',
      'Pulses and dals', 'Fish and lean protein', 'Nuts in moderate portions',
      'Coffee (unsweetened) — associated with liver benefit in NAFLD studies',
    ],
    avoidFoods: [
      'Sugar-sweetened beverages and fruit juices (fructose load)',
      'Sweets, desserts, and bakery items', 'Deep-fried foods',
      'Alcohol (compounds liver injury)', 'Refined-flour products in excess',
    ],
    recommendations: [
      'Gradual weight loss of 7–10% body weight substantially improves liver fat (EASL).',
      'Cut added sugars hard — liquid sugar is the single worst offender.',
      'A Mediterranean-style pattern is the best-evidenced diet for NAFLD.',
    ],
    warnings: [
      'Avoid alcohol entirely if you have fatty liver disease — it accelerates progression.',
    ],
    citationIds: ['easl-nafld-2016', 'who-sugar-2015', 'who-healthy-diet-2020'],
  },
  pcos: {
    condition: 'pcos',
    label: 'PCOS',
    summary:
      'Most people with PCOS have insulin resistance; lower-glycaemic, higher-fiber eating with regular protein supports both metabolic and hormonal goals.',
    safeFoods: [
      'Whole pulses, dals, and legumes', 'Millets and whole grains over refined flour',
      'Leafy and non-starchy vegetables', 'Eggs, fish, paneer, and other protein at each meal',
      'Nuts and seeds', 'Whole fruit (not juice)',
    ],
    avoidFoods: [
      'Sugar-sweetened drinks and desserts', 'Refined flour (maida) products',
      'Deep-fried snacks', 'Highly processed packaged foods',
    ],
    recommendations: [
      'Favour low-glycaemic carbohydrates; pair carbs with protein or fat.',
      'Even 5–10% weight reduction can meaningfully improve PCOS symptoms where weight loss is a goal (ESHRE 2023).',
      'Regular meal timing helps insulin management; avoid long gaps followed by large refined-carb meals.',
    ],
    warnings: [],
    citationIds: ['eshre-pcos-2023', 'who-sugar-2015'],
  },
  thyroid: {
    condition: 'thyroid',
    label: 'Thyroid Condition',
    summary:
      'Most foods are fine with thyroid conditions; the key practical points are iodine adequacy, and keeping soy and certain supplements away from medication timing.',
    safeFoods: [
      'Iodised salt (in normal amounts) for iodine adequacy',
      'Dairy, eggs, and fish (natural iodine sources)',
      'Fruits, vegetables, whole grains — no general restriction',
      'Cooked cruciferous vegetables (cooking largely deactivates goitrogens)',
    ],
    avoidFoods: [
      'Soy products within ~4 hours of levothyroxine medication (absorption interference)',
      'Very large amounts of raw cruciferous vegetables (practical concern only at extremes)',
      'Kelp/seaweed supplements (unpredictable, often excessive iodine)',
    ],
    recommendations: [
      'Take thyroid medication on an empty stomach and separate it from soy, calcium, and iron by several hours (ATA).',
      'Use iodised salt but avoid iodine mega-supplements.',
      'No special "thyroid diet" is required beyond these interactions — balanced eating applies.',
    ],
    warnings: [
      'Do not change medication timing or dose based on diet alone — discuss with your doctor.',
    ],
    citationIds: ['ata-hypothyroidism-2014', 'icmr-nin-2020'],
  },
  pregnancy: {
    condition: 'pregnancy',
    label: 'Pregnancy',
    summary:
      'Pregnancy nutrition centres on folate, iron, calcium, and protein adequacy — plus strict avoidance of alcohol and unpasteurised/raw animal foods.',
    safeFoods: [
      'Green leafy vegetables and pulses (folate, iron)', 'Dairy — pasteurised milk, curd, paneer (calcium, protein)',
      'Eggs and well-cooked fish/meat', 'Whole grains and millets',
      'Fruits and nuts', 'Iodised salt in normal cooking amounts',
    ],
    avoidFoods: [
      'Alcohol — no known safe level in pregnancy',
      'Unpasteurised milk and raw-milk cheeses (listeria risk)',
      'Raw or undercooked eggs, meat, and seafood',
      'High-mercury fish (shark, swordfish, king mackerel)',
      'Liver and retinol supplements in large amounts (vitamin A excess)',
      'Excess caffeine (keep under ~200 mg/day)',
    ],
    recommendations: [
      'Take folic acid and iron supplementation as prescribed in antenatal care (WHO).',
      'Eat protein and calcium-rich foods daily; energy needs rise modestly (not "eating for two").',
      'Wash produce well and reheat leftovers thoroughly.',
    ],
    warnings: [
      'This guidance supplements, never replaces, your antenatal care plan.',
    ],
    citationIds: ['who-antenatal-2016', 'icmr-nin-2020'],
  },
  obesity: {
    condition: 'obesity',
    label: 'Obesity / Weight Management',
    summary:
      'Sustainable weight management favours lower energy density, higher fiber and protein, and strict limits on liquid calories and free sugars.',
    safeFoods: [
      'Vegetables and salads (high volume, low energy density)', 'Whole pulses and dals',
      'Whole fruits', 'Millets and whole grains in measured portions',
      'Eggs, fish, paneer, curd — protein preserves lean mass during weight loss',
      'Water, unsweetened tea/coffee instead of caloric drinks',
    ],
    avoidFoods: [
      'Sugar-sweetened beverages and juices (liquid calories)',
      'Deep-fried snacks and namkeen', 'Sweets and desserts',
      'Refined-flour bakery products', 'Very energy-dense packaged snacks (>400 kcal/100g)',
    ],
    recommendations: [
      'Aim for a moderate, sustainable energy deficit rather than crash diets.',
      'Keep free sugars under 10% of energy — under 5% for additional benefit (WHO).',
      'Protein at every meal and fiber-rich foods improve satiety.',
      'Watch portion sizes on healthy-but-dense foods too (nuts, ghee, oils).',
    ],
    warnings: [],
    citationIds: ['who-healthy-diet-2020', 'who-sugar-2015', 'icmr-nin-2020'],
  },
  lactation: {
    condition: 'lactation',
    label: 'Breastfeeding / Lactation',
    summary:
      'Breastfeeding raises energy and fluid needs; alcohol and high-mercury fish are the main things to actively limit.',
    safeFoods: [
      'Dals, pulses, and whole grains for sustained energy', 'Plenty of fluids — water, milk, buttermilk',
      'Green leafy vegetables and dairy for calcium', 'Nuts and seeds', 'Fish low in mercury (salmon, sardines, rohu, katla)',
    ],
    avoidFoods: [
      'Alcohol (or wait 2-3 hours per drink before nursing)',
      'High-mercury fish (shark, swordfish, king mackerel)',
      'Excess caffeine',
    ],
    recommendations: [
      'Energy needs rise by roughly 400-500 kcal/day while exclusively breastfeeding — eat to appetite with nutrient-dense foods.',
      'Stay well hydrated; thirst increases with milk production.',
      'A varied, balanced diet is more important than any single "lactation food".',
    ],
    warnings: [
      'If a baby shows unusual fussiness or a rash, mention your diet to your pediatrician rather than eliminating foods on your own.',
    ],
    citationIds: ['who-antenatal-2016'],
  },
};
