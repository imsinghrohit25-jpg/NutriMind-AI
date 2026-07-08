-- Migration: 0021_consent_granted
-- Purpose: Phase 8 (Global Enterprise Edition — GDPR/DPDP consent flows). `user_consents`
-- (migration 0002) only ever recorded acceptance events (`accepted_at`, no way to represent
-- withdrawal) — but GDPR Art 7(3) and DPDP Act 2023 Section 6(4) both require consent to be
-- withdrawable as easily as it was given. The table is documented append-only ("never update
-- existing rows"), so withdrawal is modeled as a NEW row with `granted = false`, not a mutation
-- of the original acceptance row — the full history (grant → withdraw → re-grant) stays
-- queryable for audit, consistent with the table's existing design intent.
--
-- The original UNIQUE (user_id, consent_type, version) constraint would reject a withdrawal
-- row for a version that was already accepted, so it's widened to include `granted` — at most
-- one accept event and one withdraw event per (user, consent_type, version).
-- Rollback: see 0021_consent_granted_rollback.sql

BEGIN;

ALTER TABLE public.user_consents
  ADD COLUMN granted BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.user_consents
  DROP CONSTRAINT user_consents_user_id_consent_type_version_key;

ALTER TABLE public.user_consents
  ADD CONSTRAINT user_consents_user_id_consent_type_version_granted_key
  UNIQUE (user_id, consent_type, version, granted);

COMMENT ON COLUMN public.user_consents.granted IS
  'true = acceptance event, false = withdrawal event. Existing rows default true (they predate withdrawal support and were all acceptances).';

COMMIT;
