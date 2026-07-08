// Generic label format — exact port of the pre-Phase-6 patterns.ts (FSSAI-style, and
// India/UK/EU-adjacent labels generally: "per 100g" tables with unit-suffixed values).
// This is the default format; preserved verbatim so default (no-format-specified) behavior
// is byte-identical.

import type { FieldPattern, LabelFormat } from './types.js';

const v = '([\\d]+(?:[.,][\\d]+)?)';  // numeric value capture group

export const GENERIC_NUTRITION_PATTERNS: FieldPattern[] = [
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

export const GENERIC_SERVING_SIZE_PATTERNS: RegExp[] = [
  /serving\s+size\s*[:\-\s]\s*([\d,.]+)\s*(g|ml|oz|mL)/gi,
  /per\s+serving\s*\(?\s*([\d,.]+)\s*(g|ml|oz|mL)\s*\)?/gi,
  /per\s+serving\s+(?:of\s+)?([\d,.]+)\s*(g|ml|oz)/gi,
];

export const GENERIC_PER_100G_PATTERN = /per\s+100\s*g(?:ram)?/gi;
export const GENERIC_PER_SERVING_PATTERN = /per\s+serving/gi;

export const GENERIC_FORMAT: LabelFormat = {
  id: 'generic',
  displayName: 'Generic (FSSAI / per-100g table)',
  nutritionPatterns: GENERIC_NUTRITION_PATTERNS,
  servingSizePatterns: GENERIC_SERVING_SIZE_PATTERNS,
  per100gPattern: GENERIC_PER_100G_PATTERN,
  perServingPattern: GENERIC_PER_SERVING_PATTERN,
};
