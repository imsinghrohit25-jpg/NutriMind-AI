// Vegetarian / Vegan / Jain diet compatibility — pure function.
// Checks ingredient list for non-compatible ingredients.
// Source: FSSAI Food Standards (Vegetarian and Non-vegetarian Foods) Regulations 2011.

export type DietType = 'vegetarian' | 'vegan' | 'jain';

export interface DietCompatResult {
  compatible: boolean;
  incompatibleIngredients: string[];
  message: string | null;
}

// ── Keyword lists ─────────────────────────────────────────────────────────────

import { MEAT_KEYWORDS } from './vegetarian-keywords.js';

// Additional ingredients that exclude vegans (allow vegetarians)
const VEGAN_EXCLUDED = [
  'milk', 'dairy', 'lactose', 'whey', 'casein', 'caseinate',
  'butter', 'ghee', 'cream', 'cheese', 'paneer', 'curd', 'yogurt', 'yoghurt',
  'egg', 'eggs', 'albumin', 'albumen', 'honey', 'beeswax', 'royal jelly',
  'carmine', 'cochineal', 'e120',  // carmine colouring from insects
  'shellac', 'e904',
];

// Root vegetables excluded in Jain diet
const JAIN_EXCLUDED_ROOTS = [
  'potato', 'onion', 'garlic', 'carrot', 'beetroot', 'radish', 'turnip',
  'yam', 'arbi', 'lotus root', 'ginger', 'turmeric root',
  'shallot', 'leek', 'chive', 'scallion',
];

export function checkDietCompatibility(
  dietType: DietType,
  ingredientNames: string[],
): DietCompatResult {
  const joined = ingredientNames.join(' ').toLowerCase();
  const incompatible: string[] = [];

  // All diet types exclude meat
  for (const kw of MEAT_KEYWORDS) {
    if (joined.includes(kw)) incompatible.push(kw);
  }

  if (dietType === 'vegan' || dietType === 'jain') {
    for (const kw of VEGAN_EXCLUDED) {
      if (joined.includes(kw) && !incompatible.includes(kw)) {
        incompatible.push(kw);
      }
    }
  }

  if (dietType === 'jain') {
    for (const kw of JAIN_EXCLUDED_ROOTS) {
      if (joined.includes(kw) && !incompatible.includes(kw)) {
        incompatible.push(kw);
      }
    }
  }

  if (incompatible.length > 0) {
    return {
      compatible: false,
      incompatibleIngredients: incompatible,
      message: `Not suitable for ${dietType} diet: contains ${incompatible.slice(0, 3).join(', ')}${incompatible.length > 3 ? ` and ${incompatible.length - 3} more` : ''}.`,
    };
  }

  return { compatible: true, incompatibleIngredients: [], message: null };
}
