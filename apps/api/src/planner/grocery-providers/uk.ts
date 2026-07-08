// United Kingdom Grocery Price Provider — approximate retail averages (GBP/kg), directionally
// anchored to 2026 UK supermarket price surveys (potatoes ≈£0.84/kg, carrots ≈£0.70/kg,
// rice ≈£1.12/kg, cheese ≈£3.50/kg, milk ≈£0.55/pint ≈£0.97/L, chicken breast ≈£3.50/kg club
// pack); remaining items are standard-shelf-price ballparks in the same spirit as the
// pre-Phase-5 India table (an approximate budgeting estimate, not live pricing data).
//
// Ingredient keys match the vocabulary recipe-generator.ts currently produces (recipes remain
// India-cuisine-focused pending a future localization pass — see ADR-0018).

import type { GroceryPriceProvider } from './types.js';

export const UK_GROCERY_PROVIDER: GroceryPriceProvider = {
  id: 'uk_retail_avg',
  displayName: 'United Kingdom — approximate retail average',
  isoCountryCodes: ['GB'],
  currencyCode: 'GBP',
  pricePerKg: {
    // Grains
    'rice': 1.12, 'atta': 1.60, 'maida': 1.10, 'poha': 2.60, 'oats': 1.90, 'dalia': 2.60,
    // Lentils / legumes
    'dal': 2.20, 'chana': 2.40, 'rajma': 2.80, 'moong': 2.60, 'urad': 2.80, 'masoor': 2.40,
    // Dairy
    'paneer': 7.50, 'milk': 0.97, 'curd': 2.60, 'ghee': 9.50, 'butter': 7.00,
    // Vegetables
    'onion': 0.90, 'tomato': 2.50, 'potato': 0.84, 'spinach': 4.00, 'methi': 6.50,
    'cauliflower': 1.80, 'capsicum': 4.20, 'carrot': 0.70, 'beans': 3.30, 'peas': 2.80, 'brinjal': 2.60,
    // Oil
    'oil': 2.80, 'mustard oil': 5.50,
    // Spices (per 100g equivalent)
    'garam masala': 2.80, 'cumin': 3.60, 'coriander': 2.60, 'turmeric': 2.60, 'chilli': 3.10,
    // Protein
    'chicken': 6.00, 'eggs': 4.20,
    // Nuts
    'peanuts': 5.00, 'cashews': 12.50, 'almonds': 11.00, 'makhana': 14.50,
  },
  categoryMap: {
    'rice': 'grains', 'atta': 'grains', 'maida': 'grains', 'poha': 'grains',
    'oats': 'grains', 'dalia': 'grains',
    'dal': 'legumes', 'chana': 'legumes', 'rajma': 'legumes', 'moong': 'legumes',
    'urad': 'legumes', 'masoor': 'legumes', 'peas': 'legumes',
    'paneer': 'dairy', 'milk': 'dairy', 'curd': 'dairy',
    'ghee': 'dairy', 'butter': 'dairy',
    'onion': 'produce', 'tomato': 'produce', 'potato': 'produce',
    'spinach': 'produce', 'methi': 'produce', 'cauliflower': 'produce',
    'capsicum': 'produce', 'carrot': 'produce', 'beans': 'produce',
    'brinjal': 'produce',
    'oil': 'oil', 'mustard oil': 'oil',
    'chicken': 'protein', 'eggs': 'protein',
    'peanuts': 'nuts', 'cashews': 'nuts', 'almonds': 'nuts', 'makhana': 'nuts',
  },
  defaultPricePerKg: 3.60,
  categoryOrder: ['produce', 'dairy', 'protein', 'legumes', 'grains', 'oil', 'nuts', 'spices'],
  roundToDecimals: 2,
};
