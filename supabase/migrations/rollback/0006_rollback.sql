-- Rollback 0006: Remove meal/cart/report tables
DROP TABLE IF EXISTS public.weekly_reports CASCADE;
DROP TABLE IF EXISTS public.grocery_cart_items CASCADE;
DROP TABLE IF EXISTS public.grocery_cart_sessions CASCADE;
DROP TABLE IF EXISTS public.meal_logs CASCADE;
