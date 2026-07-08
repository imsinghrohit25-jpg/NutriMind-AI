-- Migration: 0020_grocery_currency
-- Purpose: Phase 5 (Country-aware grocery price providers). Generalizes grocery_items'
-- India-only INR price column to a currency-agnostic one, per the GroceryPriceProvider
-- registry (apps/api/src/planner/grocery-providers/). Pre-launch schema, no production data
-- to preserve — a straight rename is cleaner than layering a parallel column (see ADR-0018).
-- Rollback: see 0020_grocery_currency_rollback.sql

BEGIN;

ALTER TABLE grocery_items RENAME COLUMN estimated_rs TO estimated_price;

ALTER TABLE grocery_items
  ADD COLUMN currency_code text NOT NULL DEFAULT 'INR';

COMMENT ON COLUMN grocery_items.estimated_price IS
  'Approximate retail price estimate in currency_code — not live pricing data.';
COMMENT ON COLUMN grocery_items.currency_code IS
  'ISO 4217 currency code for estimated_price, set by the GroceryPriceProvider that priced this item.';

COMMIT;
