-- Rollback: 0029_ifct_nutrient_extensions
BEGIN;

DROP POLICY IF EXISTS "food_groups_service_write" ON public.food_groups;
DROP POLICY IF EXISTS "food_groups_read_all_authenticated" ON public.food_groups;
DROP TABLE IF EXISTS public.food_groups;

ALTER TABLE public.product_nutrition
  DROP COLUMN IF EXISTS ash_g,
  DROP COLUMN IF EXISTS moisture_g,
  DROP COLUMN IF EXISTS nutrient_sd,
  DROP COLUMN IF EXISTS nutrient_value_state;

COMMIT;
