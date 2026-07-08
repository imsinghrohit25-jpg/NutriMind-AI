// India Grocery Price Provider — exact port of the pre-Phase-5 hardcoded table
// (apps/api/src/planner/grocery-optimizer.ts), preserved verbatim so default
// (no-provider-specified) behavior is byte-identical.

import type { GroceryPriceProvider } from './types.js';

export const INDIA_GROCERY_PROVIDER: GroceryPriceProvider = {
  id: 'in_retail_avg',
  displayName: 'India — approximate retail average',
  isoCountryCodes: ['IN'],
  currencyCode: 'INR',
  pricePerKg: {
    // Grains
    'rice':       60,    'atta':       45,   'maida':      40,
    'poha':       70,    'oats':      120,   'dalia':      80,
    // Lentils
    'dal':        90,    'chana':     100,   'rajma':     130,
    'moong':     100,    'urad':      110,   'masoor':     90,
    // Dairy
    'paneer':    400,    'milk':       60,   'curd':       60,
    'ghee':     600,     'butter':    500,
    // Vegetables (approximate)
    'onion':      30,    'tomato':     40,   'potato':     35,
    'spinach':    40,    'methi':      30,   'cauliflower':50,
    'capsicum':   80,    'carrot':     50,   'beans':      70,
    'peas':       60,    'brinjal':    40,
    // Oil
    'oil':       130,    'mustard oil':160,
    // Spices (per 100g)
    'garam masala':  300 / 10, // ₹300/kg → ₹30/100g
    'cumin':         400 / 10,
    'coriander':     200 / 10,
    'turmeric':      200 / 10,
    'chilli':        300 / 10,
    // Protein
    'chicken':   300,    'eggs':       80,
    // Nuts
    'peanuts':   120,    'cashews':   900,  'almonds': 1200,
    'makhana':   700,
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
  defaultPricePerKg: 50,
  categoryOrder: ['produce', 'dairy', 'protein', 'legumes', 'grains', 'oil', 'nuts', 'spices'],
  roundToDecimals: 0,
};
