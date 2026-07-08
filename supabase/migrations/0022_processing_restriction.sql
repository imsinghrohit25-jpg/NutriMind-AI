-- Migration: 0022_processing_restriction
-- Purpose: Phase 8 (DSR endpoints — `global.p8.dsr_endpoints`). GDPR Art. 18 ("right to
-- restriction of processing") and DPDP Act 2023 Sec. 12 (correction/erasure request handling)
-- both give a data subject the right to have processing paused without full erasure (e.g. while
-- a correction or objection is under review). This is a distinct concept from `user_consents`
-- (a purpose-consent grant/withdrawal log) — it's a rights-exercise action, not a consent — so
-- it gets its own small append-only table rather than overloading `consent_type` with a
-- non-consent value. Same append-only shape and RLS pattern as `user_consents` (0002/0010).
-- Rollback: see 0022_processing_restriction_rollback.sql

BEGIN;

CREATE TABLE public.processing_restrictions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restricted   BOOLEAN     NOT NULL,
  reason       TEXT,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX processing_restrictions_user_idx ON public.processing_restrictions(user_id, recorded_at DESC);

ALTER TABLE public.processing_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processing_restrictions: owner select"
  ON public.processing_restrictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "processing_restrictions: owner insert"
  ON public.processing_restrictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.processing_restrictions IS
  'Append-only log of GDPR Art. 18 / DPDP Sec. 12 processing-restriction requests. Latest row per user_id wins. Recording a restriction here does NOT itself pause any processing pipeline — see ADR-0021 for which consumers currently check it (none yet; a named, tracked gap).';

COMMIT;
