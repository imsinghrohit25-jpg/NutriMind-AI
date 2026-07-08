-- Rollback: 0021_consent_granted
-- Removes Phase 8 additions. Safe to run after 0021 fails mid-migration.
-- Note: if any withdrawal rows (granted = false) were inserted before rollback, this
-- rollback does NOT delete them — it only restores the pre-0021 constraint shape. Running the
-- original UNIQUE (user_id, consent_type, version) constraint back against data that now has
-- duplicate (user_id, consent_type, version) rows (one granted, one withdrawn) will fail; clear
-- withdrawal rows first if this rollback needs to run against post-Phase-8 data.

BEGIN;

ALTER TABLE public.user_consents
  DROP CONSTRAINT IF EXISTS user_consents_user_id_consent_type_version_granted_key;

ALTER TABLE public.user_consents
  ADD CONSTRAINT user_consents_user_id_consent_type_version_key
  UNIQUE (user_id, consent_type, version);

ALTER TABLE public.user_consents
  DROP COLUMN IF EXISTS granted;

COMMIT;
