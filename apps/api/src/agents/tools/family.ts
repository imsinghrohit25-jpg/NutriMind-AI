// family.members — Phase 13 (§16.3, real necessary addition — see types.ts's comment on this
// ToolName entry). Wraps the real family_members table (migration 0016, family/family-service.ts)
// joined with users_profiles for each member's own diet/allergen data — a service-role read
// across real, separate user accounts that are verified household members via family_members
// itself (not an arbitrary cross-user read).

import type { ToolDefinition, ToolContext } from '../types.js';

export interface FamilyMemberProfile {
  userId: string;
  displayName: string;
  role: 'owner' | 'member';
  ageYears: number | null;
  dietType: string | null;
  allergens: string[];
}

export const familyMembersTool: ToolDefinition<Record<string, never>, FamilyMemberProfile[]> = {
  name: 'family.members',
  description: 'Real household members (from the family group the current user belongs to) with each member\'s own diet type/allergens/age — never invented.',
  execute: async (_input, ctx) => {
    const { data: groupRows, error: groupErr } = await ctx.supabase
      .from('family_members')
      .select('group_id')
      .eq('user_id', ctx.userId);
    if (groupErr) throw new Error(`family.members: ${groupErr.message}`);
    if (!groupRows || groupRows.length === 0) return [];

    const groupIds = [...new Set((groupRows as Array<{ group_id: string }>).map((r) => r.group_id))];

    const { data: memberRows, error: memberErr } = await ctx.supabase
      .from('family_members')
      .select('user_id, role')
      .in('group_id', groupIds);
    if (memberErr) throw new Error(`family.members: ${memberErr.message}`);

    const members = (memberRows ?? []) as Array<{ user_id: string; role: 'owner' | 'member' }>;
    const userIds = [...new Set(members.map((m) => m.user_id))];

    const { data: profileRows, error: profileErr } = await ctx.supabase
      .from('users_profiles')
      .select('id, display_name, age_years, diet_type, allergens')
      .in('id', userIds);
    if (profileErr) throw new Error(`family.members: ${profileErr.message}`);

    const profileById = new Map(
      ((profileRows ?? []) as Array<{ id: string; display_name: string; age_years: number | null; diet_type: string | null; allergens: string[] | null }>)
        .map((p) => [p.id, p]),
    );

    return members
      .map((m): FamilyMemberProfile | null => {
        const profile = profileById.get(m.user_id);
        if (!profile) return null;
        return {
          userId: m.user_id,
          displayName: profile.display_name,
          role: m.role,
          ageYears: profile.age_years,
          dietType: profile.diet_type,
          allergens: profile.allergens ?? [],
        };
      })
      .filter((m): m is FamilyMemberProfile => m !== null);
  },
};
