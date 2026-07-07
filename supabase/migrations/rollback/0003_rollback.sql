-- Rollback 0003: Remove catalog tables (reverse dependency order)
DROP TABLE IF EXISTS public.product_ingredient_items CASCADE;
DROP TABLE IF EXISTS public.ingredients CASCADE;
DROP TABLE IF EXISTS public.product_ingredients CASCADE;
DROP TABLE IF EXISTS public.product_nutrition CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.allergen_taxonomy CASCADE;
DROP TABLE IF EXISTS public.data_sources CASCADE;
DROP FUNCTION IF EXISTS public.handle_products_updated_at();
DROP FUNCTION IF EXISTS public.handle_product_nutrition_updated_at();
DROP FUNCTION IF EXISTS public.handle_ingredients_updated_at();
