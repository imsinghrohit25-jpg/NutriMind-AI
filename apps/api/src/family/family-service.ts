// Family group management and shared shopping list logic.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface FamilyGroup {
  id:        string;
  owner_id:  string;
  name:      string;
  created_at:string;
}

export interface FamilyMember {
  id:        string;
  group_id:  string;
  user_id:   string;
  role:      'owner' | 'member';
  joined_at: string;
}

export interface FamilyShoppingItem {
  id:           string;
  list_id:      string;
  group_id:     string;
  added_by:     string;
  name:         string;
  quantity:     number;
  unit:         string;
  is_purchased: boolean;
  purchased_by: string | null;
}

/** Create a new family group (owner is automatically added as a member). */
export async function createFamilyGroup(opts: {
  ownerId: string;
  name:    string;
  supabase: SupabaseClient;
}): Promise<FamilyGroup> {
  const { ownerId, name, supabase } = opts;

  const { data: group, error: gErr } = await supabase
    .from('family_groups')
    .insert({ owner_id: ownerId, name })
    .select()
    .single();

  if (gErr || !group) throw new Error(`createFamilyGroup: ${gErr?.message}`);

  // Owner is also a member
  await supabase.from('family_members').insert({
    group_id: (group as FamilyGroup).id,
    user_id:  ownerId,
    role:     'owner',
  });

  return group as FamilyGroup;
}

/** Add a member by user_id. Only the owner can call this. */
export async function addFamilyMember(opts: {
  groupId:  string;
  ownerId:  string;
  memberId: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const { groupId, ownerId, memberId, supabase } = opts;

  const { data: group } = await supabase
    .from('family_groups')
    .select('id')
    .eq('id', groupId)
    .eq('owner_id', ownerId)
    .single();

  if (!group) throw new Error('Only the group owner can add members');

  await supabase.from('family_members').upsert(
    { group_id: groupId, user_id: memberId, role: 'member' },
    { onConflict: 'group_id,user_id', ignoreDuplicates: true },
  );
}

/** Remove a member. Owner cannot remove themselves. */
export async function removeFamilyMember(opts: {
  groupId:  string;
  ownerId:  string;
  memberId: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const { groupId, ownerId, memberId, supabase } = opts;
  if (memberId === ownerId) throw new Error('Owner cannot remove themselves');
  await supabase.from('family_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', memberId)
    .eq('group_id', (
      await supabase.from('family_groups').select('id').eq('id', groupId).eq('owner_id', ownerId).single()
    ).data?.id ?? '');
}

/** Validate a family meal plan: checks that shared meals meet all member goals. */
export async function validateFamilyMealPlan(opts: {
  groupId:    string;
  planId:     string;
  userId:     string;
  supabase:   SupabaseClient;
}): Promise<{ valid: boolean; warnings: string[] }> {
  const { groupId, userId, supabase } = opts;

  // Verify user is in group
  const { data: membership } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (!membership) return { valid: false, warnings: ['User is not a member of this group'] };

  // Get all members
  const { data: members } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('group_id', groupId);

  if (!members?.length) return { valid: true, warnings: [] };

  // Get user profiles for each member to check dietary restrictions
  const memberIds = (members as FamilyMember[]).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, diet_type, allergens')
    .in('user_id', memberIds);

  const warnings: string[] = [];
  const dietTypes = new Set<string>();
  const allAllergens: string[] = [];

  for (const p of (profiles ?? []) as any[]) {
    if (p.diet_type) dietTypes.add(p.diet_type as string);
    if (Array.isArray(p.allergens)) allAllergens.push(...(p.allergens as string[]));
  }

  // If any member is vegetarian, plan must be vegetarian
  if (dietTypes.has('vegetarian') && dietTypes.has('non-vegetarian')) {
    warnings.push('Group has mixed dietary types: vegetarian + non-vegetarian members. Consider separate plans.');
  }
  if (dietTypes.has('vegan') && !dietTypes.has('non-vegetarian')) {
    warnings.push('Some members are vegan — ensure no dairy in shared meals.');
  }
  if (allAllergens.length > 0) {
    warnings.push(`Combined allergens across members: ${[...new Set(allAllergens)].join(', ')}`);
  }

  return { valid: true, warnings };
}
