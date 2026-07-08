// United States Grocery Price Provider — approximate retail averages (USD/kg), directionally
// anchored to BLS Average Retail Food Prices / USDA Food Price Outlook (2026) for the items
// where a direct series exists (potatoes ≈ $1.97/kg from BLS APU0000712112, $0.894/lb, May 2026);
// remaining items are standard-shelf-price ballparks in the same spirit as the pre-Phase-5
// India table (an approximate budgeting estimate, not live pricing data).
//
// Ingredient keys intentionally match the vocabulary recipe-generator.ts currently produces
// (recipes remain India-cuisine-focused pending a future localization pass — see ADR-0018) —
// 'dal' is priced as lentils, 'atta' as whole wheat flour, 'paneer' as a soft cheese analogue,
// 'ghee' as clarified butter, etc.

import type { GroceryPriceProvider } from './types.js';

export const US_GROCERY_PROVIDER: GroceryPriceProvider = {
  id: 'us_retail_avg',
  displayName: 'United States — approximate retail average',
  isoCountryCodes: ['US'],
  currencyCode: 'USD',
  pricePerKg: {
    // Grains
    'rice': 2.20, 'atta': 2.60, 'maida': 1.80, 'poha': 3.30, 'oats': 3.90, 'dalia': 3.30,
    // Lentils / legumes
    'dal': 2.60, 'chana': 2.90, 'rajma': 3.30, 'moong': 3.10, 'urad': 3.30, 'masoor': 2.90,
    // Dairy
    'paneer': 9.90, 'milk': 1.00, 'curd': 3.30, 'ghee': 12.00, 'butter': 8.80,
    // Vegetables
    'onion': 2.20, 'tomato': 3.30, 'potato': 1.97, 'spinach': 6.60, 'methi': 8.80,
    'cauliflower': 3.30, 'capsicum': 5.50, 'carrot': 1.75, 'beans': 4.40, 'peas': 3.90, 'brinjal': 3.30,
    // Oil
    'oil': 3.30, 'mustard oil': 6.60,
    // Spices (per 100g equivalent)
    'garam masala': 3.30, 'cumin': 4.40, 'coriander': 3.30, 'turmeric': 3.30, 'chilli': 3.90,
    // Protein
    'chicken': 7.50, 'eggs': 6.00,
    // Nuts
    'peanuts': 6.60, 'cashews': 15.40, 'almonds': 13.20, 'makhana': 17.60,
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
  defaultPricePerKg: 4.40,
  categoryOrder: ['produce', 'dairy', 'protein', 'legumes', 'grains', 'oil', 'nuts', 'spices'],
  roundToDecimals: 2,
};
