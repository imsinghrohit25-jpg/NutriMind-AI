-- Migration 0003: Food catalog — data_sources, allergen_taxonomy, products,
--   product_nutrition, product_ingredients, product_ingredient_items, ingredients
-- Rollback: supabase/migrations/rollback/0003_rollback.sql
-- Validate: supabase/migrations/validate/0003_validate.sql
--
-- Cross-cutting invariant: every row carrying nutrition facts has NOT NULL provenance columns
--   (source, source_id, dataset_version, retrieved_at, license_class).
-- This is enforced at the schema level — the API cannot omit these fields.

-- ---------------------------------------------------------------------------
-- data_sources  (canonical registry of every data origin)
-- ---------------------------------------------------------------------------
CREATE TABLE public.data_sources (
  id               TEXT        PRIMARY KEY,
  display_name     TEXT        NOT NULL,
  base_url         TEXT,
  license_class    TEXT        NOT NULL CHECK (license_class IN ('odbl','public_domain','licensed_restricted','user_submitted','internal')),
  attribution_text TEXT        NOT NULL,
  terms_url        TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- allergen_taxonomy  (FSSAI + international classification)
-- ---------------------------------------------------------------------------
CREATE TABLE public.allergen_taxonomy (
  id                TEXT        PRIMARY KEY,
  display_name      TEXT        NOT NULL,
  fssai_category    TEXT,
  aliases           TEXT[]      NOT NULL DEFAULT '{}',
  parent_allergen_id TEXT       REFERENCES public.allergen_taxonomy(id),
  description       TEXT,
  is_major          BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- products  (canonical product records; one row per barcode×source)
-- ---------------------------------------------------------------------------
CREATE TABLE public.products (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode              TEXT,
  barcode_type         TEXT         CHECK (barcode_type IN ('ean13','ean8','upc_a','upc_e','qr','other')),
  name                 TEXT         NOT NULL,
  brand                TEXT,
  category             TEXT,
  sub_category         TEXT,
  country_of_origin    TEXT,
  serving_size_g       NUMERIC(8,2) CHECK (serving_size_g > 0),
  serving_description  TEXT,
  package_size_g       NUMERIC(8,2) CHECK (package_size_g > 0),
  is_verified          BOOLEAN      NOT NULL DEFAULT false,
  -- Vegetarian/vegan mark (from packaging; cross-checked in M5)
  fssai_veg_mark       TEXT         CHECK (fssai_veg_mark IN ('green','red','unknown')),
  -- Provenance (NOT NULL: cross-cutting invariant)
  source               TEXT         NOT NULL REFERENCES public.data_sources(id),
  source_id            TEXT         NOT NULL,
  dataset_version      TEXT         NOT NULL,
  retrieved_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  license_class        TEXT         NOT NULL,
  -- Images
  image_url            TEXT,
  thumbnail_url        TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE INDEX products_barcode_idx     ON public.products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX products_name_trgm_idx   ON public.products USING GIN (name extensions.gin_trgm_ops);
CREATE INDEX products_category_idx    ON public.products(category) WHERE category IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_products_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_products_updated_at();

-- ---------------------------------------------------------------------------
-- product_nutrition  (nutrition facts per 100 g; NOT NULL provenance)
-- ---------------------------------------------------------------------------
CREATE TABLE public.product_nutrition (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              UUID         NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- Energy
  energy_kcal             NUMERIC(8,2),
  energy_kj               NUMERIC(8,2),
  -- Macronutrients (g per 100 g)
  protein_g               NUMERIC(8,3),
  fat_total_g             NUMERIC(8,3),
  fat_saturated_g         NUMERIC(8,3),
  fat_trans_g             NUMERIC(8,3),
  fat_polyunsaturated_g   NUMERIC(8,3),
  fat_monounsaturated_g   NUMERIC(8,3),
  carbohydrates_g         NUMERIC(8,3),
  sugars_g                NUMERIC(8,3),
  -- Added sugar: estimated via rules when not labeled; method documented in ADR
  sugars_added_g          NUMERIC(8,3),
  sugars_added_estimated  BOOLEAN      NOT NULL DEFAULT false,
  dietary_fiber_g         NUMERIC(8,3),
  -- Minerals & sodium
  sodium_mg               NUMERIC(8,2),
  cholesterol_mg          NUMERIC(8,2),
  calcium_mg              NUMERIC(8,2),
  iron_mg                 NUMERIC(8,3),
  potassium_mg            NUMERIC(8,2),
  zinc_mg                 NUMERIC(8,3),
  -- Key vitamins
  vitamin_c_mg            NUMERIC(8,3),
  vitamin_a_iu            NUMERIC(10,2),
  vitamin_d_iu            NUMERIC(10,2),
  vitamin_b12_mcg         NUMERIC(8,3),
  folate_mcg              NUMERIC(8,2),
  -- NOVA ultra-processing classification (1=unprocessed … 4=ultra-processed)
  nova_group              SMALLINT     CHECK (nova_group BETWEEN 1 AND 4),
  -- Provenance (NOT NULL: cross-cutting invariant)
  source                  TEXT         NOT NULL REFERENCES public.data_sources(id),
  source_id               TEXT         NOT NULL,
  dataset_version         TEXT         NOT NULL,
  retrieved_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  license_class           TEXT         NOT NULL,
  -- Confidence / uncertainty disclosure (D4)
  confidence              NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  notes                   TEXT,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_nutrition_product_uniq ON public.product_nutrition(product_id);
CREATE INDEX product_nutrition_source_idx ON public.product_nutrition(source);

CREATE OR REPLACE FUNCTION public.handle_product_nutrition_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER product_nutrition_updated_at
  BEFORE UPDATE ON public.product_nutrition
  FOR EACH ROW EXECUTE FUNCTION public.handle_product_nutrition_updated_at();

-- ---------------------------------------------------------------------------
-- product_ingredients  (raw ingredient string from label / OCR)
-- ---------------------------------------------------------------------------
CREATE TABLE public.product_ingredients (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID         NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  raw_text            TEXT         NOT NULL,
  parsed_at           TIMESTAMPTZ,
  parsing_confidence  NUMERIC(4,3) CHECK (parsing_confidence BETWEEN 0 AND 1),
  -- Provenance (NOT NULL)
  source              TEXT         NOT NULL REFERENCES public.data_sources(id),
  source_id           TEXT         NOT NULL,
  dataset_version     TEXT         NOT NULL,
  retrieved_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  license_class       TEXT         NOT NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_ingredients_product_uniq ON public.product_ingredients(product_id);

-- ---------------------------------------------------------------------------
-- ingredients  (canonical ingredient / additive registry)
-- ---------------------------------------------------------------------------
CREATE TABLE public.ingredients (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT         NOT NULL,
  common_names     TEXT[]       NOT NULL DEFAULT '{}',
  ins_number       TEXT,
  category         TEXT         CHECK (category IN ('additive','allergen','nutrient','whole_food','flavoring','processing_aid','other')),
  allergen_classes TEXT[]       NOT NULL DEFAULT '{}',
  is_vegan         BOOLEAN,
  is_vegetarian    BOOLEAN,
  is_jain          BOOLEAN,
  fssai_status     TEXT         CHECK (fssai_status IN ('permitted','restricted','prohibited','under_review','not_regulated')),
  efsa_status      TEXT,
  jecfa_status     TEXT,
  safety_summary   TEXT,
  citation_url     TEXT,
  -- Provenance (NOT NULL)
  source           TEXT         NOT NULL REFERENCES public.data_sources(id),
  source_id        TEXT         NOT NULL,
  dataset_version  TEXT         NOT NULL,
  retrieved_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  license_class    TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ingredients_name_trgm_idx ON public.ingredients USING GIN (name extensions.gin_trgm_ops);
CREATE INDEX ingredients_ins_idx       ON public.ingredients(ins_number) WHERE ins_number IS NOT NULL;
CREATE INDEX ingredients_category_idx  ON public.ingredients(category);

CREATE OR REPLACE FUNCTION public.handle_ingredients_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.handle_ingredients_updated_at();

-- ---------------------------------------------------------------------------
-- product_ingredient_items  (parsed + normalized ingredient list items)
-- ---------------------------------------------------------------------------
CREATE TABLE public.product_ingredient_items (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_ingredient_id   UUID        NOT NULL REFERENCES public.product_ingredients(id) ON DELETE CASCADE,
  ingredient_id           UUID        REFERENCES public.ingredients(id),
  display_text            TEXT        NOT NULL,
  position                SMALLINT    NOT NULL CHECK (position >= 0),
  quantity_text           TEXT,
  is_allergen_flag        BOOLEAN     NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX product_ingredient_items_pi_idx  ON public.product_ingredient_items(product_ingredient_id);
CREATE INDEX product_ingredient_items_ing_idx ON public.product_ingredient_items(ingredient_id) WHERE ingredient_id IS NOT NULL;
