import { describe, it, expect, vi } from 'vitest';
import { requestRestriction, liftRestriction, getRestrictionStatus } from '../restriction-service.js';

function buildMockSupabase(latestRow: { restricted: boolean; reason: string | null; recorded_at: string } | null = null) {
  const insertResult = { data: null, error: null };
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve(insertResult)),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: latestRow, error: null })),
            })),
          })),
        })),
      })),
    })),
  };
}

describe('requestRestriction', () => {
  it('inserts a restricted=true row', async () => {
    const supabase = buildMockSupabase();
    await requestRestriction(supabase as never, 'user-1', 'reviewing a correction request');
    expect(supabase.from).toHaveBeenCalledWith('processing_restrictions');
    const insertCall = supabase.from.mock.results[0]!.value.insert;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', restricted: true, reason: 'reviewing a correction request' }),
    );
  });
});

describe('liftRestriction', () => {
  it('inserts a restricted=false row', async () => {
    const supabase = buildMockSupabase();
    await liftRestriction(supabase as never, 'user-1');
    const insertCall = supabase.from.mock.results[0]!.value.insert;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({ restricted: false, reason: null }),
    );
  });
});

describe('getRestrictionStatus', () => {
  it('returns null when no restriction has ever been requested', async () => {
    const supabase = buildMockSupabase(null);
    const status = await getRestrictionStatus(supabase as never, 'user-1');
    expect(status).toBeNull();
  });

  it('returns the latest recorded status', async () => {
    const supabase = buildMockSupabase({ restricted: true, reason: 'dispute', recorded_at: '2026-01-01T00:00:00Z' });
    const status = await getRestrictionStatus(supabase as never, 'user-1');
    expect(status).toEqual({ restricted: true, reason: 'dispute', recordedAt: new Date('2026-01-01T00:00:00Z') });
  });
});
