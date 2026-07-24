-- Rollback: 0035_global_profile_fields
BEGIN;

ALTER TABLE public.users_profiles
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS phone_number,
  DROP COLUMN IF EXISTS primary_health_goal;

COMMIT;
