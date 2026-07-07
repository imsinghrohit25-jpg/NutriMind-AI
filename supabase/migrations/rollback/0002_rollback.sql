-- Rollback 0002: Remove identity tables (reverse dependency order)
DROP TABLE IF EXISTS public.user_consents CASCADE;
DROP TABLE IF EXISTS public.household_members CASCADE;
DROP TABLE IF EXISTS public.users_profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_users_profiles_updated_at();
DROP FUNCTION IF EXISTS public.handle_household_members_updated_at();
