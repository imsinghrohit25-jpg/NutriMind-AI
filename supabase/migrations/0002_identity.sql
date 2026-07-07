-- Migration 0002: Identity — users_profiles, household_members, user_consents
-- Rollback: supabase/migrations/rollback/0002_rollback.sql
-- Validate: supabase/migrations/validate/0002_validate.sql
--
-- Design notes:
--   users_profiles extends auth.users 1:1; no duplicate of auth fields (email, phone).
--   household_members are sub-profiles owned by a head user (D2 Family Guardian).
--   user_consents is append-only; never update existing rows.

-- ---------------------------------------------------------------------------
-- users_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.users_profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT        NOT NULL,
  age_years         SMALLINT    CHECK (age_years BETWEEN 1 AND 120),
  biological_sex    TEXT        CHECK (biological_sex IN ('male','female','other','prefer_not_to_say')),
  height_cm         NUMERIC(5,1) CHECK (height_cm BETWEEN 50 AND 300),
  weight_kg         NUMERIC(5,1) CHECK (weight_kg BETWEEN 1 AND 600),
  activity_level    TEXT        CHECK (activity_level IN ('sedentary','lightly_active','moderately_active','very_active','extra_active')),
  goal              TEXT        CHECK (goal IN ('lose','maintain','gain')),
  -- TDEE and macro targets: computed by engine, stored for offline access
  tdee_kcal         INTEGER     CHECK (tdee_kcal > 0),
  macro_protein_g   NUMERIC(6,1),
  macro_fat_g       NUMERIC(6,1),
  macro_carbs_g     NUMERIC(6,1),
  -- Dietary preferences at the profile level (member-level overrides in household_members)
  diet_type         TEXT        CHECK (diet_type IN ('non_vegetarian','vegetarian','eggetarian','vegan','jain','other')),
  conditions        TEXT[]      NOT NULL DEFAULT '{}',
  allergens         TEXT[]      NOT NULL DEFAULT '{}',
  preferred_language TEXT       NOT NULL DEFAULT 'en',
  onboarding_complete BOOLEAN   NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_users_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_profiles_updated_at
  BEFORE UPDATE ON public.users_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_users_profiles_updated_at();

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------
CREATE TABLE public.household_members (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     TEXT        NOT NULL,
  relationship     TEXT        CHECK (relationship IN ('self','spouse','partner','child','parent','sibling','other')),
  age_years        SMALLINT    CHECK (age_years BETWEEN 0 AND 120),
  biological_sex   TEXT        CHECK (biological_sex IN ('male','female','other','prefer_not_to_say')),
  weight_kg        NUMERIC(5,1) CHECK (weight_kg BETWEEN 1 AND 600),
  -- Health context
  conditions       TEXT[]      NOT NULL DEFAULT '{}',
  allergens        TEXT[]      NOT NULL DEFAULT '{}',
  diet_type        TEXT        CHECK (diet_type IN ('non_vegetarian','vegetarian','eggetarian','vegan','jain','other')),
  is_child         BOOLEAN     NOT NULL DEFAULT false,
  -- Children get age-appropriate safety evaluation (M6 Child Safety)
  child_age_months SMALLINT    CHECK (child_age_months BETWEEN 0 AND 216),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX household_members_owner_idx ON public.household_members(owner_id);

CREATE OR REPLACE FUNCTION public.handle_household_members_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER household_members_updated_at
  BEFORE UPDATE ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_household_members_updated_at();

-- ---------------------------------------------------------------------------
-- user_consents  (append-only; no UPDATE/DELETE via RLS)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_consents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- consent_type: tos | privacy | health_data | disclaimer | marketing
  consent_type TEXT        NOT NULL,
  version      TEXT        NOT NULL,
  accepted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address   INET,
  user_agent   TEXT,
  UNIQUE (user_id, consent_type, version)
);

CREATE INDEX user_consents_user_idx ON public.user_consents(user_id);
