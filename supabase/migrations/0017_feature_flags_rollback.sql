-- Rollback for 0017_feature_flags
-- Drops the feature_flags table entirely.
-- Safe to run: no other table references feature_flags.

BEGIN;

DROP TABLE IF EXISTS feature_flags;

COMMIT;
