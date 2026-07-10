-- Rollback: 0030_ifct_nutrient_extra_values
BEGIN;

ALTER TABLE public.product_nutrition
  DROP COLUMN IF EXISTS nutrient_extra;

COMMIT;
