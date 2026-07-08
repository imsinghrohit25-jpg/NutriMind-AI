-- Rollback: 0020_grocery_currency
-- Removes Phase 5 additions. Safe to run after 0020 fails mid-migration.

BEGIN;

ALTER TABLE grocery_items DROP COLUMN IF EXISTS currency_code;

ALTER TABLE grocery_items RENAME COLUMN estimated_price TO estimated_rs;

COMMIT;
