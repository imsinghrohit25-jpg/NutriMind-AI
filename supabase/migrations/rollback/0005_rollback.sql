-- Rollback 0005: Remove intelligence tables
DROP TABLE IF EXISTS public.member_safety_evaluations CASCADE;
DROP TABLE IF EXISTS public.ingredient_assessments CASCADE;
DROP TABLE IF EXISTS public.health_scores CASCADE;
