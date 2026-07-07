-- Migration 0010: Row Level Security — all user-owned and canonical tables
-- Rollback: supabase/migrations/rollback/0010_rollback.sql
-- Validate: supabase/migrations/validate/0010_validate.sql
--
-- Policy matrix:
--   user-owned tables:    SELECT/INSERT/UPDATE/DELETE where user_id = auth.uid()
--   household member:     owner_id = auth.uid() for all operations
--   member-linked tables: JOIN through household_members.owner_id = auth.uid()
--   canonical/public:     authenticated SELECT; service_role INSERT/UPDATE/DELETE
--   ops tables:           service_role only (no direct user access)
--   user_consents:        user INSERT own; no UPDATE/DELETE (append-only)

-- ---------------------------------------------------------------------------
-- Helper: is the calling role the Supabase service_role?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
    OR current_role = 'service_role';
$$;

-- ============================================================================
-- users_profiles
-- ============================================================================
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_profiles: owner select"
  ON public.users_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_profiles: owner insert"
  ON public.users_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_profiles: owner update"
  ON public.users_profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============================================================================
-- household_members
-- ============================================================================
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_members: owner all"
  ON public.household_members FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============================================================================
-- user_consents  (append-only: INSERT only, no UPDATE/DELETE for users)
-- ============================================================================
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_consents: owner select"
  ON public.user_consents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_consents: owner insert"
  ON public.user_consents FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- data_sources  (canonical: any authenticated user can read)
-- ============================================================================
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "data_sources: authenticated read"
  ON public.data_sources FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "data_sources: service_role write"
  ON public.data_sources FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- allergen_taxonomy  (canonical: authenticated read)
-- ============================================================================
ALTER TABLE public.allergen_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allergen_taxonomy: authenticated read"
  ON public.allergen_taxonomy FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "allergen_taxonomy: service_role write"
  ON public.allergen_taxonomy FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- products  (canonical: authenticated read; service_role write)
-- ============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products: authenticated read"
  ON public.products FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "products: service_role write"
  ON public.products FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- product_nutrition  (canonical: authenticated read; service_role write)
-- ============================================================================
ALTER TABLE public.product_nutrition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_nutrition: authenticated read"
  ON public.product_nutrition FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "product_nutrition: service_role write"
  ON public.product_nutrition FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- product_ingredients / product_ingredient_items  (canonical)
-- ============================================================================
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_ingredients: authenticated read"
  ON public.product_ingredients FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "product_ingredients: service_role write"
  ON public.product_ingredients FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

ALTER TABLE public.product_ingredient_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_ingredient_items: authenticated read"
  ON public.product_ingredient_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "product_ingredient_items: service_role write"
  ON public.product_ingredient_items FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- ingredients  (canonical: authenticated read; service_role write)
-- ============================================================================
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredients: authenticated read"
  ON public.ingredients FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "ingredients: service_role write"
  ON public.ingredients FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- scans  (user-owned)
-- ============================================================================
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scans: owner all"
  ON public.scans FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- scan_images  (via scans; owner must own the parent scan)
-- ============================================================================
ALTER TABLE public.scan_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_images: owner select"
  ON public.scan_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "scan_images: owner insert"
  ON public.scan_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "scan_images: owner delete"
  ON public.scan_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- health_scores  (canonical scores: authenticated read; personalized: owner)
-- ============================================================================
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_scores: canonical read"
  ON public.health_scores FOR SELECT
  TO authenticated
  USING (user_id IS NULL AND member_id IS NULL);

CREATE POLICY "health_scores: owner personalized read"
  ON public.health_scores FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "health_scores: owner member read"
  ON public.health_scores FOR SELECT
  USING (
    member_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.id = member_id AND hm.owner_id = auth.uid()
    )
  );

CREATE POLICY "health_scores: service_role write"
  ON public.health_scores FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- ingredient_assessments  (canonical: authenticated read; service_role write)
-- ============================================================================
ALTER TABLE public.ingredient_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredient_assessments: authenticated read"
  ON public.ingredient_assessments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "ingredient_assessments: service_role write"
  ON public.ingredient_assessments FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- member_safety_evaluations  (owner via member)
-- ============================================================================
ALTER TABLE public.member_safety_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_safety: owner select"
  ON public.member_safety_evaluations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.id = member_id AND hm.owner_id = auth.uid()
    )
  );

CREATE POLICY "member_safety: service_role write"
  ON public.member_safety_evaluations FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- meal_logs  (user-owned)
-- ============================================================================
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_logs: owner all"
  ON public.meal_logs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- grocery_cart_sessions + items
-- ============================================================================
ALTER TABLE public.grocery_cart_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grocery_cart_sessions: owner all"
  ON public.grocery_cart_sessions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.grocery_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grocery_cart_items: owner select"
  ON public.grocery_cart_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grocery_cart_sessions gcs
      WHERE gcs.id = cart_session_id AND gcs.user_id = auth.uid()
    )
  );

CREATE POLICY "grocery_cart_items: owner insert"
  ON public.grocery_cart_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grocery_cart_sessions gcs
      WHERE gcs.id = cart_session_id AND gcs.user_id = auth.uid()
    )
  );

CREATE POLICY "grocery_cart_items: owner delete"
  ON public.grocery_cart_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.grocery_cart_sessions gcs
      WHERE gcs.id = cart_session_id AND gcs.user_id = auth.uid()
    )
  );

-- ============================================================================
-- weekly_reports  (user-owned)
-- ============================================================================
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_reports: owner all"
  ON public.weekly_reports FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- recommendations  (user-owned)
-- ============================================================================
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recommendations: owner all"
  ON public.recommendations FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- copilot_conversations + messages
-- ============================================================================
ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_conversations: owner all"
  ON public.copilot_conversations FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_messages: owner select"
  ON public.copilot_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.copilot_conversations cc
      WHERE cc.id = conversation_id AND cc.user_id = auth.uid()
    )
  );

CREATE POLICY "copilot_messages: owner insert"
  ON public.copilot_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.copilot_conversations cc
      WHERE cc.id = conversation_id AND cc.user_id = auth.uid()
    )
  );

CREATE POLICY "copilot_messages: service_role write"
  ON public.copilot_messages FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- knowledge_documents + knowledge_chunks  (canonical: authenticated read)
-- ============================================================================
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_documents: authenticated read"
  ON public.knowledge_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "knowledge_documents: service_role write"
  ON public.knowledge_documents FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_chunks: authenticated read"
  ON public.knowledge_chunks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "knowledge_chunks: service_role write"
  ON public.knowledge_chunks FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- product_embeddings  (canonical: authenticated read)
-- ============================================================================
ALTER TABLE public.product_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_embeddings: authenticated read"
  ON public.product_embeddings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "product_embeddings: service_role write"
  ON public.product_embeddings FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- user_history_embeddings  (user-owned)
-- ============================================================================
ALTER TABLE public.user_history_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_history_embeddings: owner all"
  ON public.user_history_embeddings FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- llm_call_log + audit_log  (ops: service_role only)
-- ============================================================================
ALTER TABLE public.llm_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "llm_call_log: service_role only"
  ON public.llm_call_log FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log: service_role only"
  ON public.audit_log FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- feature_flags  (authenticated read; service_role write)
-- ============================================================================
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags: authenticated read"
  ON public.feature_flags FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "feature_flags: service_role write"
  ON public.feature_flags FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());

-- ============================================================================
-- curation_queue  (service_role only)
-- ============================================================================
ALTER TABLE public.curation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curation_queue: service_role only"
  ON public.curation_queue FOR ALL
  USING (public.is_service_role()) WITH CHECK (public.is_service_role());
