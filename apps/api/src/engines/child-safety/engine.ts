// Child safety engine — pure function.
// Applies stricter nutrition limits and additive flags for members aged ≤ 12.
// Source: WHO Child Sodium Reduction 2020; AHA Child Sugar 2016; FSSAI; EFSA "Southampton Six".

export interface ChildSafetyInput {
  memberAgeYears: number;
  sodiumMg:       number | null | undefined;
  sugarsAddedG:   number | null | undefined;
  sugarsG:        number | null | undefined;
  caffeineMg?:    number | null | undefined;
  ingredientNames?: string[];
  transFatG?:     number | null | undefined;
}

export interface ChildSafetyWarning {
  type: 'sodium' | 'sugar' | 'caffeine' | 'artificial_colour' | 'trans_fat';
  severity: 'warning' | 'caution';
  message: string;
  citationId: string;
}

export interface ChildSafetyResult {
  isChildProfile: boolean;
  warnings: ChildSafetyWarning[];
  hasWarnings: boolean;
}

// "Southampton Six" artificial colours linked to hyperactivity in children
const SOUTHAMPTON_SIX_KEYWORDS = [
  'e102', 'tartrazine',
  'e104', 'quinoline yellow',
  'e110', 'sunset yellow',
  'e122', 'carmoisine', 'azorubine',
  'e124', 'ponceau 4r',
  'e129', 'allura red',
];

// Stricter thresholds for children (5–12 years, reference 25kg child)
const CHILD_SODIUM_WARNING_MG  = 600;   // WHO: <1200 mg/day; single product >600mg is material
const CHILD_SODIUM_CAUTION_MG  = 300;
const CHILD_SUGAR_WARNING_G    = 10;    // AHA: <25g/day added sugar
const CHILD_SUGAR_CAUTION_G    =  5;

export function checkChildSafety(input: ChildSafetyInput): ChildSafetyResult {
  const { memberAgeYears } = input;
  const isChild = memberAgeYears <= 12;

  if (!isChild) {
    return { isChildProfile: false, warnings: [], hasWarnings: false };
  }

  const warnings: ChildSafetyWarning[] = [];

  // ── Sodium ────────────────────────────────────────────────────────────────
  const sodiumMg = input.sodiumMg;
  if (sodiumMg != null) {
    if (sodiumMg > CHILD_SODIUM_WARNING_MG) {
      warnings.push({
        type: 'sodium',
        severity: 'warning',
        message:
          `High sodium for a child: ${sodiumMg} mg/100g. WHO recommends children aged 5–12 consume < 1200 mg sodium per day total. ` +
          `This product alone contains a large portion of that limit.`,
        citationId: 'who-child-sodium-2020',
      });
    } else if (sodiumMg > CHILD_SODIUM_CAUTION_MG) {
      warnings.push({
        type: 'sodium',
        severity: 'caution',
        message: `Moderate sodium (${sodiumMg} mg/100g) for a child. Monitor total daily intake.`,
        citationId: 'who-child-sodium-2020',
      });
    }
  }

  // ── Sugar ─────────────────────────────────────────────────────────────────
  const sugarG = input.sugarsAddedG ?? input.sugarsG;
  if (sugarG != null) {
    if (sugarG > CHILD_SUGAR_WARNING_G) {
      warnings.push({
        type: 'sugar',
        severity: 'warning',
        message:
          `High sugar for a child: ${sugarG.toFixed(1)}g/100g. The American Heart Association recommends children aged 2–18 consume < 25g added sugar per day. ` +
          `This product may supply a significant portion of that limit.`,
        citationId: 'aha-child-sugar-2016',
      });
    } else if (sugarG > CHILD_SUGAR_CAUTION_G) {
      warnings.push({
        type: 'sugar',
        severity: 'caution',
        message: `Moderate sugar (${sugarG.toFixed(1)}g/100g) for a child. Limit portion size.`,
        citationId: 'aha-child-sugar-2016',
      });
    }
  }

  // ── Caffeine ──────────────────────────────────────────────────────────────
  const caffeineMg = input.caffeineMg;
  if (caffeineMg != null && caffeineMg > 0) {
    warnings.push({
      type: 'caffeine',
      severity: 'warning',
      message:
        `This product contains caffeine (${caffeineMg} mg). Caffeine is not recommended for children. ` +
        `FSSAI requires caffeine declaration on energy drinks.`,
      citationId: 'fssai-labelling-2022',
    });
  }

  // ── Artificial colours (Southampton Six) ───────────────────────────────────
  const ingredientText = (input.ingredientNames ?? []).join(' ').toLowerCase();
  const foundColour = SOUTHAMPTON_SIX_KEYWORDS.find((kw) => ingredientText.includes(kw));
  if (foundColour) {
    warnings.push({
      type: 'artificial_colour',
      severity: 'caution',
      message:
        `Contains artificial colour "${foundColour}" (Southampton Six). ` +
        `EFSA 2009 found an association between these colours and increased hyperactivity in some children. ` +
        `EU law requires a warning label "may have an adverse effect on activity and attention in children".`,
      citationId: 'fssai-labelling-2022',
    });
  }

  // ── Trans fat ─────────────────────────────────────────────────────────────
  const transFatG = input.transFatG;
  if (transFatG != null && transFatG > 0.5) {
    warnings.push({
      type: 'trans_fat',
      severity: 'warning',
      message:
        `Contains trans fat (${transFatG.toFixed(2)}g/100g). WHO recommends eliminating trans fats from the food supply; ` +
        `children are particularly vulnerable to CVD risk factors.`,
      citationId: 'who-transfat-2023',
    });
  }

  return { isChildProfile: true, warnings, hasWarnings: warnings.length > 0 };
}
