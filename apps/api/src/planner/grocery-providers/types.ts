// Grocery Price Provider types — Phase 5.
// A provider supplies approximate per-kg retail prices and category mappings for a single
// country/currency. All prices are market-average estimates for shopping-list budgeting —
// not live pricing data — same caveat the pre-Phase-5 India-only table already carried.

export interface GroceryPriceProvider {
  /** DB/registry key, e.g. 'in_retail_avg'. */
  id: string;
  displayName: string;
  isoCountryCodes: string[];
  currencyCode: string;
  /** Approximate retail price per kg (or per litre for liquids), keyed by ingredient-name substring match. */
  pricePerKg: Record<string, number>;
  /** Ingredient-name substring → shopping category, for sort ordering. */
  categoryMap: Record<string, string>;
  /** Fallback price per kg when no ingredient match is found. */
  defaultPricePerKg: number;
  /** Category sort order for the shopping list (produce first, etc.). */
  categoryOrder: string[];
  /** Decimal places to round estimated prices to (0 for whole-rupee-style currencies). */
  roundToDecimals: number;
}
