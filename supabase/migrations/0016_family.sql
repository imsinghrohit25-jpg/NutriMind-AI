-- Phase 19: Family Nutrition Dashboard
-- Tables: family_groups, family_members, family_shopping_lists, family_shopping_items

-- ── Family groups ─────────────────────────────────────────────────────────────
CREATE TABLE family_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Family members (maps users into groups) ───────────────────────────────────
CREATE TABLE family_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- ── Shared family shopping lists ──────────────────────────────────────────────
CREATE TABLE family_shopping_lists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Family shopping items (realtime collaborative) ────────────────────────────
CREATE TABLE family_shopping_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id         uuid NOT NULL REFERENCES family_shopping_lists(id) ON DELETE CASCADE,
  group_id        uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  added_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  quantity        numeric NOT NULL DEFAULT 1,
  unit            text NOT NULL DEFAULT 'units',
  is_purchased    boolean NOT NULL DEFAULT false,
  purchased_by    uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_family_members_user ON family_members (user_id);
CREATE INDEX idx_family_members_group ON family_members (group_id);
CREATE INDEX idx_family_shopping_items_list ON family_shopping_items (list_id);

-- ── Realtime publication for shopping items ───────────────────────────────────
ALTER TABLE family_shopping_items REPLICA IDENTITY FULL;
-- Note: enable realtime in Supabase dashboard for family_shopping_items table

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE family_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_shopping_lists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_shopping_items  ENABLE ROW LEVEL SECURITY;

-- family_groups: owner sees/modifies own group; members see groups they belong to
CREATE POLICY "owner_manages_group"
  ON family_groups FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "members_see_group"
  ON family_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.group_id = id AND fm.user_id = auth.uid()
    )
  );

-- family_members: group owner manages; member can see their own membership
CREATE POLICY "owner_manages_members"
  ON family_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM family_groups fg
      WHERE fg.id = group_id AND fg.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_groups fg
      WHERE fg.id = group_id AND fg.owner_id = auth.uid()
    )
  );

CREATE POLICY "members_see_own_membership"
  ON family_members FOR SELECT
  USING (auth.uid() = user_id);

-- family_shopping_lists: group members can read/write
CREATE POLICY "group_members_manage_lists"
  ON family_shopping_lists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.group_id = family_shopping_lists.group_id AND fm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.group_id = family_shopping_lists.group_id AND fm.user_id = auth.uid()
    )
  );

-- family_shopping_items: group members can read/write
CREATE POLICY "group_members_manage_items"
  ON family_shopping_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.group_id = family_shopping_items.group_id AND fm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.group_id = family_shopping_items.group_id AND fm.user_id = auth.uid()
    )
  );
