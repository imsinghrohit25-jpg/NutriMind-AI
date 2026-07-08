// AI Memory System — seasonal produce reference data. Phase 11 (§12.2, seasonal_pattern facts).
// Static, versioned, cited data — never LLM-generated. Each country's list is a simplified
// monthly calendar of widely-available seasonal produce, sourced from well-established public
// agricultural-extension seasonal guides (see `source` per country below). This is intentionally
// coarse (a handful of headline items per month, not an exhaustive commodity board) — good
// enough for the seasonal-affinity string-match in aggregation/seasonal-patterns.ts, not a
// claim of agricultural completeness.
//
// Also seeded into the `seasonal_produce` table (migration 0024) so it's queryable/editable
// without a deploy; this module is the fast, dependency-free lookup path the aggregation job
// uses (see jobs/handlers/memory-aggregation.ts) — keep both in sync if either changes.

export interface SeasonalProduceCountryData {
  countryCode: string;
  source: string;
  /** 1 = January .. 12 = December */
  byMonth: Record<number, string[]>;
}

// India — Rabi (winter, Oct-Mar), Zaid (summer, Mar-Jun), Kharif (monsoon, Jun-Oct) crop
// seasons. Source: ICAR (Indian Council of Agricultural Research) crop calendar; National
// Horticulture Board seasonal availability charts.
const INDIA: SeasonalProduceCountryData = {
  countryCode: 'IN',
  source: 'ICAR crop calendar / National Horticulture Board seasonal availability charts',
  byMonth: {
    1: ['spinach', 'carrot', 'cauliflower', 'peas', 'fenugreek', 'orange'],
    2: ['spinach', 'carrot', 'cauliflower', 'peas', 'strawberry'],
    3: ['mango', 'watermelon', 'cucumber', 'bottle gourd'],
    4: ['mango', 'watermelon', 'muskmelon', 'jackfruit'],
    5: ['mango', 'litchi', 'watermelon', 'jackfruit'],
    6: ['mango', 'litchi', 'jamun', 'cucumber'],
    7: ['jamun', 'okra', 'bitter gourd', 'ridge gourd'],
    8: ['okra', 'bitter gourd', 'apple', 'pear'],
    9: ['pomegranate', 'guava', 'okra'],
    10: ['pomegranate', 'guava', 'sweet potato', 'carrot'],
    11: ['carrot', 'cauliflower', 'peas', 'radish', 'orange'],
    12: ['carrot', 'cauliflower', 'peas', 'radish', 'orange', 'strawberry'],
  },
};

// United States — USDA "What's In Season" regional harvest guides (national-average, skews
// temperate/continental).
const US: SeasonalProduceCountryData = {
  countryCode: 'US',
  source: 'USDA seasonal produce guide (nationwide average)',
  byMonth: {
    1: ['kale', 'sweet potato', 'grapefruit', 'cabbage'],
    2: ['kale', 'sweet potato', 'orange', 'cabbage'],
    3: ['artichoke', 'asparagus', 'spinach'],
    4: ['asparagus', 'spinach', 'strawberry'],
    5: ['strawberry', 'asparagus', 'peas'],
    6: ['strawberry', 'blueberry', 'zucchini', 'corn'],
    7: ['corn', 'tomato', 'peach', 'watermelon'],
    8: ['corn', 'tomato', 'peach', 'watermelon'],
    9: ['apple', 'pumpkin', 'grape', 'pear'],
    10: ['apple', 'pumpkin', 'squash', 'pear'],
    11: ['squash', 'cranberry', 'sweet potato', 'brussels sprout'],
    12: ['cranberry', 'sweet potato', 'brussels sprout', 'citrus'],
  },
};

// United Kingdom — UK Food & Drink Federation / Eat Seasonably seasonal calendar.
const GB: SeasonalProduceCountryData = {
  countryCode: 'GB',
  source: 'Eat Seasonably (UK Food & Drink Federation) seasonal calendar',
  byMonth: {
    1: ['leek', 'parsnip', 'swede', 'brussels sprout'],
    2: ['leek', 'parsnip', 'purple sprouting broccoli'],
    3: ['purple sprouting broccoli', 'spring onion', 'rhubarb'],
    4: ['rhubarb', 'asparagus', 'spinach'],
    5: ['asparagus', 'new potato', 'strawberry'],
    6: ['strawberry', 'broad bean', 'pea', 'cherry'],
    7: ['broad bean', 'courgette', 'raspberry', 'cherry'],
    8: ['tomato', 'sweetcorn', 'plum', 'blackberry'],
    9: ['apple', 'pear', 'plum', 'pumpkin'],
    10: ['apple', 'pumpkin', 'squash', 'parsnip'],
    11: ['parsnip', 'swede', 'brussels sprout', 'leek'],
    12: ['brussels sprout', 'parsnip', 'swede', 'leek'],
  },
};

// UAE — arid, minimal domestic agriculture; the vast majority of produce is imported
// year-round, so a "seasonal calendar" in the Indian/UK/US sense doesn't meaningfully apply.
// The few genuinely seasonal domestic crops (winter-grown desert farming, Nov-Mar) are listed;
// otherwise the affinity fact will honestly show low match rates most of the year, which is
// correct — not a data gap.
const AE: SeasonalProduceCountryData = {
  countryCode: 'AE',
  source: 'UAE Ministry of Climate Change & Environment — winter desert-farming produce (Nov-Mar); no meaningful summer domestic season',
  byMonth: {
    11: ['tomato', 'cucumber', 'eggplant', 'date'],
    12: ['tomato', 'cucumber', 'eggplant', 'date'],
    1: ['tomato', 'cucumber', 'eggplant', 'date'],
    2: ['tomato', 'cucumber', 'eggplant'],
    3: ['tomato', 'cucumber', 'eggplant'],
  },
};

// Singapore — tropical city-state, negligible domestic agriculture (>90% food imported per
// Singapore Food Agency); no meaningful seasonal produce calendar exists. Left empty rather
// than fabricated — the seasonal-affinity fact will simply not be computed for SG users.
const SG: SeasonalProduceCountryData = {
  countryCode: 'SG',
  source: 'Singapore Food Agency — >90% of food is imported; no domestic seasonal calendar to cite',
  byMonth: {},
};

// Australia — Southern Hemisphere (seasons inverted vs. US/UK/EU). Source: Fresh for Kids /
// Hort Innovation Australia seasonal produce guide.
const AU: SeasonalProduceCountryData = {
  countryCode: 'AU',
  source: 'Hort Innovation Australia seasonal produce guide (Southern Hemisphere)',
  byMonth: {
    1: ['mango', 'stone fruit', 'zucchini', 'corn'],
    2: ['stone fruit', 'tomato', 'corn'],
    3: ['fig', 'grape', 'pear'],
    4: ['apple', 'pear', 'pumpkin'],
    5: ['pumpkin', 'sweet potato', 'orange'],
    6: ['orange', 'broccoli', 'cauliflower'],
    7: ['broccoli', 'cauliflower', 'leek'],
    8: ['leek', 'silverbeet', 'kiwifruit'],
    9: ['asparagus', 'strawberry', 'spinach'],
    10: ['asparagus', 'strawberry', 'pea'],
    11: ['cherry', 'mango', 'pea'],
    12: ['cherry', 'mango', 'stone fruit'],
  },
};

// Canada — Foodland Ontario / Canadian seasonal produce guides (national-average, skews
// temperate; short domestic growing season means many winter months rely on stored/imported
// staples, reflected here as root-vegetable-heavy).
const CA: SeasonalProduceCountryData = {
  countryCode: 'CA',
  source: 'Foodland Ontario seasonal availability guide',
  byMonth: {
    1: ['squash', 'cabbage', 'potato', 'carrot'],
    2: ['squash', 'cabbage', 'potato'],
    3: ['maple syrup', 'potato', 'cabbage'],
    4: ['asparagus', 'rhubarb'],
    5: ['asparagus', 'rhubarb', 'radish'],
    6: ['strawberry', 'pea', 'lettuce'],
    7: ['strawberry', 'blueberry', 'corn', 'zucchini'],
    8: ['corn', 'tomato', 'peach', 'blueberry'],
    9: ['apple', 'pumpkin', 'grape'],
    10: ['apple', 'pumpkin', 'squash'],
    11: ['squash', 'cabbage', 'carrot'],
    12: ['squash', 'cabbage', 'carrot', 'potato'],
  },
};

// Germany — Bundeszentrum für Ernährung (German Federal Centre for Nutrition) seasonal calendar.
const DE: SeasonalProduceCountryData = {
  countryCode: 'DE',
  source: 'Bundeszentrum für Ernährung (BZfE) Saisonkalender',
  byMonth: {
    1: ['kale', 'leek', 'cabbage', 'parsnip'],
    2: ['kale', 'leek', 'cabbage'],
    3: ['spinach', 'radish', 'rhubarb'],
    4: ['asparagus', 'spinach', 'radish'],
    5: ['asparagus', 'strawberry', 'radish'],
    6: ['strawberry', 'cherry', 'pea'],
    7: ['cherry', 'blueberry', 'cucumber', 'tomato'],
    8: ['plum', 'tomato', 'zucchini'],
    9: ['apple', 'pear', 'pumpkin', 'plum'],
    10: ['apple', 'pumpkin', 'squash'],
    11: ['kale', 'cabbage', 'leek'],
    12: ['kale', 'cabbage', 'leek', 'parsnip'],
  },
};

export const SEASONAL_PRODUCE_REGISTRY: Record<string, SeasonalProduceCountryData> = {
  IN: INDIA, US, GB, AE, SG, AU, CA, DE,
};

/** Real, cited seasonal produce for a country/month, or an empty array when no meaningful
 *  calendar exists (e.g. Singapore) or the country isn't in the Tier-1 seed set — never a
 *  fabricated fallback list. */
export function seasonalItemsFor(countryCode: string, month: number): string[] {
  return SEASONAL_PRODUCE_REGISTRY[countryCode.toUpperCase()]?.byMonth[month] ?? [];
}
