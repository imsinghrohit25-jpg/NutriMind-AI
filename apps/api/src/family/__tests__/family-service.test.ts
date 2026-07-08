// Family service tests — group creation and meal plan validator.

import { describe, it, expect, vi } from 'vitest';
import { createFamilyGroup, validateFamilyMealPlan } from '../family-service.js';

/** Build a chainable mock that resolves to `resolveWith` when awaited or .single() called. */
function chain(resolveWith: { data: any; error: any }): any {
  const q: any = {};
  // All builder methods return `q` so calls can be chained indefinitely
  const selfReturn = () => q;
  q.select  = vi.fn(selfReturn);
  q.eq      = vi.fn(selfReturn);
  q.in      = vi.fn().mockResolvedValue(resolveWith);
  q.single  = vi.fn().mockResolvedValue(resolveWith);
  q.insert  = vi.fn(selfReturn);
  q.upsert  = vi.fn().mockResolvedValue({ error: null });
  q.delete  = vi.fn(selfReturn);
  // Make the builder itself awaitable — when awaited directly (no .single())
  q.then    = (resolve: any) => Promise.resolve(resolveWith).then(resolve);
  return q;
}

describe('createFamilyGroup', () => {
  it('inserts group and adds owner as member', async () => {
    const groupData = { id: 'g1', owner_id: 'u1', name: 'Family', created_at: '' };
    const tables: string[] = [];
    const supabase = {
      from: vi.fn().mockImplementation((t: string) => {
        tables.push(t);
        return chain({ data: groupData, error: null });
      }),
    } as any;

    const result = await createFamilyGroup({ ownerId: 'u1', name: 'Family', supabase });
    expect(result.id).toBe('g1');
    expect(tables).toContain('family_groups');
    expect(tables).toContain('family_members');
  });
});

describe('validateFamilyMealPlan', () => {
  it('returns invalid if user is not a group member', async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => chain({ data: null, error: null })),
    } as any;

    const result = await validateFamilyMealPlan({ groupId: 'g1', planId: 'p1', userId: 'u1', supabase });
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toMatch(/not a member/i);
  });

  it('warns about mixed vegetarian and non-vegetarian members', async () => {
    // Track call count to vary responses
    let call = 0;
    const supabase = {
      from: vi.fn().mockImplementation(() => {
        call++;
        if (call === 1) {
          // membership: found
          return chain({ data: { user_id: 'u1' }, error: null });
        }
        if (call === 2) {
          // members list
          return chain({ data: [{ user_id: 'u1' }, { user_id: 'u2' }], error: null });
        }
        // profiles
        return chain({ data: [
          { id: 'u1', diet_type: 'vegetarian',      allergens: [] },
          { id: 'u2', diet_type: 'non_vegetarian',  allergens: [] },
        ], error: null });
      }),
    } as any;

    const result = await validateFamilyMealPlan({ groupId: 'g1', planId: 'p1', userId: 'u1', supabase });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => /mixed dietary/i.test(w))).toBe(true);
  });

  it('aggregates allergens across all members', async () => {
    let call = 0;
    const supabase = {
      from: vi.fn().mockImplementation(() => {
        call++;
        if (call === 1) return chain({ data: { user_id: 'u1' }, error: null });
        if (call === 2) return chain({ data: [{ user_id: 'u1' }, { user_id: 'u2' }], error: null });
        return chain({ data: [
          { id: 'u1', diet_type: 'vegetarian', allergens: ['peanuts'] },
          { id: 'u2', diet_type: 'vegetarian', allergens: ['dairy'] },
        ], error: null });
      }),
    } as any;

    const result = await validateFamilyMealPlan({ groupId: 'g1', planId: 'p1', userId: 'u1', supabase });
    const combined = result.warnings.join(' ');
    expect(combined).toMatch(/peanuts/i);
    expect(combined).toMatch(/dairy/i);
  });

  it('returns no warnings for a homogenous vegetarian group', async () => {
    let call = 0;
    const supabase = {
      from: vi.fn().mockImplementation(() => {
        call++;
        if (call === 1) return chain({ data: { user_id: 'u1' }, error: null });
        if (call === 2) return chain({ data: [{ user_id: 'u1' }, { user_id: 'u2' }], error: null });
        return chain({ data: [
          { id: 'u1', diet_type: 'vegetarian', allergens: [] },
          { id: 'u2', diet_type: 'vegetarian', allergens: [] },
        ], error: null });
      }),
    } as any;

    const result = await validateFamilyMealPlan({ groupId: 'g1', planId: 'p1', userId: 'u1', supabase });
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
