-- Phase 17: Meal Planner + Smart Grocery Planner
-- Tables: meal_plans, meal_plan_items, grocery_lists, grocery_items

-- ── Meal plans ───────────────────────────────────────────────────────────────
CREATE TABLE meal_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  diet_type    text NOT NULL DEFAULT 'vegetarian',
  kcal_target  integer,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','draft')),
  generated_by text NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai','manual')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Individual meal plan items (one row per meal per day) ────────────────────
CREATE TABLE meal_plan_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id    uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date       date NOT NULL,
  meal_type       text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  recipe_name     text NOT NULL,
  recipe_data     jsonb NOT NULL DEFAULT '{}',  -- full GeneratedRecipe JSON
  kcal_estimate   integer,
  protein_g       numeric,
  is_complete     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Grocery lists (generated from meal plan) ─────────────────────────────────
CREATE TABLE grocery_lists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id uuid REFERENCES meal_plans(id) ON DELETE SET NULL,
  title        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Grocery items ─────────────────────────────────────────────────────────────
CREATE TABLE grocery_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grocery_list_id uuid NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  quantity        numeric NOT NULL,
  unit            text NOT NULL,
  category        text,      -- 'dairy', 'produce', 'grains', 'spices', 'protein', 'oil'
  estimated_rs    numeric,   -- price estimate in INR
  is_purchased    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_meal_plan_items_plan_date ON meal_plan_items (meal_plan_id, plan_date);
CREATE INDEX idx_grocery_items_list ON grocery_items (grocery_list_id);

-- RLS
ALTER TABLE meal_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_meal_plans"
  ON meal_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_meal_plan_items"
  ON meal_plan_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_grocery_lists"
  ON grocery_lists FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_grocery_items"
  ON grocery_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
