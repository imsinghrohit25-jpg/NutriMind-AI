-- Rollback for 0018_country_preferences

BEGIN;

ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS preferred_country,
  DROP COLUMN IF EXISTS detected_country;

COMMIT;
