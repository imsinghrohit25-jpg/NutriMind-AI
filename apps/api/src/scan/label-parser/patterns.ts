// Regex patterns for extracting nutrition values from Indian label OCR text.
// Indian FSSAI labels (Food Safety and Standards Act 2006) mandate specific fields.
// All patterns are case-insensitive; values are in the label's declared unit.

export interface FieldPattern {
  field: string;
  patterns: RegExp[];
  unit: 'kcal' | 'kj' | 'g' | 'mg' | 'mcg' | 'iu' | 'percent';
}

// Each pattern tries to match: field name variants → optional colon/space → numeric value.
// Groups: (1) = value, (2) = optional decimal, (3) = optional unit
const v = '([\\d]+(?:[.,][\\d]+)?)';  // numeric value capture group

export const NUTRITION_PATTERNS: FieldPattern[] = [
  {
    field: 'energyKcal',
    unit: 'kcal',
    patterns: [
      new RegExp(`(?:energy|calories?|cal\\.?|kcal)\\s*[:\\-\\s]\\s*${v}\\s*(?:kcal|k\\.cal|calories?)`, 'gi'),
      new RegExp(`${v}\\s*(?:kcal|k\\.cal)`, 'gi'),
    ],
  },
  {
    field: 'energyKj',
    unit: 'kj',
    patterns: [
      new RegExp(`(?:energy|kj)\\s*[:\\-\\s]\\s*${v}\\s*(?:kj|k\\.j)`, 'gi'),
      new RegExp(`${v}\\s*kj`, 'gi'),
    ],
  },
  {
    field: 'proteinG',
    unit: 'g',
    patterns: [
      new RegExp(`(?:protein|proteins?)\\s*[:\\-\\s]\\s*${v}\\s*g?`, 'gi'),
    ],
  },
  {
    field: 'fatTotalG',
    unit: 'g',
    patterns: [
      new RegExp(`(?:total\\s+)?fat\\s*[:\\-\\s]\\s*${v}\\s*g?`, 'gi'),
    ],
  },
  {
    field: 'fatSaturatedG',
    unit: 'g',
    patterns: [
      new RegExp(`(?:saturated\\s+(?:fatty\\s+acids?|fat)|sat(?:\\.|urated)?\\s+fat)\\s*[:\\-\\s]\\s*${v}\\s*g?`, 'gi'),
    ],
  },
  {
    field: 'fatTransG',
    unit: 'g',
    patterns: [
      new RegExp(`(?:trans\\s+(?:fatty\\s+acids?|fat)|trans\\s*fat)\\s*[:\\-\\s]\\s*${v}\\s*g?`, 'gi'),
    ],
  },
  {
    field: 'carbohydratesG',
    unit: 'g',
    patterns: [
      new RegExp(`(?:total\\s+)?carbohydrate[s]?\\s*[:\\-\\s]\\s*${v}\\s*g?`, 'gi'),
      new RegExp(`(?:carbs?)\\s*[:\\-\\s]\\s*${v}\\s*g?`, 'gi'),
    ],
  },
  {
    field: 'sugarsG',
    unit: 'g',
    patterns: [
      new RegExp(`(?:total\\s+)?sugars?\\s*[:\\-\\s]\\s*${v}\\s*g?`, 'gi'),
    ],
  },
  {
    field: 'sugarsAddedG',
    unit: 'g',
    patterns: [
      new RegExp(`(?:added\\s+sugars?|sugars?,?\\s+added)\\s*[:\\-\\s]\\s*${v}\\s*g?`, 'gi'),
    ],
  },
  {
    field: 'fibreG',
    unit: 'g',
    patterns: [
      new RegExp(`(?:dietary\\s+)?fib(?:re|er)[s]?\\s*[:\\-\\s]\\s*${v}\\s*g?`, 'gi'),
    ],
  },
  {
    field: 'sodiumMg',
    unit: 'mg',
    patterns: [
      new RegExp(`sodium\\s*[:\\-\\s]\\s*${v}\\s*(?:mg)?`, 'gi'),
    ],
  },
  {
    field: 'calciumMg',
    unit: 'mg',
    patterns: [
      new RegExp(`calcium\\s*[:\\-\\s]\\s*${v}\\s*(?:mg|%)?`, 'gi'),
    ],
  },
  {
    field: 'ironMg',
    unit: 'mg',
    patterns: [
      new RegExp(`iron\\s*[:\\-\\s]\\s*${v}\\s*(?:mg|%)?`, 'gi'),
    ],
  },
  {
    field: 'vitaminCMg',
    unit: 'mg',
    patterns: [
      new RegExp(`(?:vitamin\\s+c|ascorbic\\s+acid)\\s*[:\\-\\s]\\s*${v}\\s*(?:mg)?`, 'gi'),
    ],
  },
  {
    field: 'cholesterolMg',
    unit: 'mg',
    patterns: [
      new RegExp(`cholesterol\\s*[:\\-\\s]\\s*${v}\\s*(?:mg)?`, 'gi'),
    ],
  },
];

// Patterns to detect serving size declarations on the label.
export const SERVING_SIZE_PATTERNS: RegExp[] = [
  /serving\s+size\s*[:\-\s]\s*([\d,.]+)\s*(g|ml|oz|mL)/gi,
  /per\s+serving\s*\(?\s*([\d,.]+)\s*(g|ml|oz|mL)\s*\)?/gi,
  /per\s+serving\s+(?:of\s+)?([\d,.]+)\s*(g|ml|oz)/gi,
];

// Patterns to detect "per 100g" vs "per serving" context.
export const PER_100G_PATTERN = /per\s+100\s*g(?:ram)?/gi;
export const PER_SERVING_PATTERN = /per\s+serving/gi;
