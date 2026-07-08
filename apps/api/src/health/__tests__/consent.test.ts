// Consent management tests — gate: revoking consent stops sync and deletes data.

import { describe, it, expect, vi } from 'vitest';
import { grantConsent, revokeConsent, grantedMetricTypes } from '../consent.js';

function buildMockSupabase(
  consents: Array<{ user_id: string; metric_type: string; granted: boolean }> = [],
  deletedCount = 3,
) {
  const upsertResult = { data: null, error: null };
  const deleteResult = {
    data: Array.from({ length: deletedCount }).map((_, i) => ({ id: `row-${i}` })),
    error: null,
  };

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: consents, error: null })),
      })),
      upsert: vi.fn(() => Promise.resolve(upsertResult)),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve(deleteResult)),
          })),
        })),
      })),
    })),
  };
}

describe('grantConsent', () => {
  it('calls upsert with granted=true', async () => {
    const supabase = buildMockSupabase();
    await grantConsent('user-1', 'steps', supabase as never);
    expect(supabase.from).toHaveBeenCalledWith('health_consents');
  });
});

describe('revokeConsent', () => {
  it('marks consent revoked AND deletes synced data', async () => {
    const supabase = buildMockSupabase([], 5);
    const result = await revokeConsent('user-1', 'blood_glucose', supabase as never);
    // Should have touched health_consents (upsert) and health_metrics (delete)
    expect(supabase.from).toHaveBeenCalledWith('health_consents');
    expect(supabase.from).toHaveBeenCalledWith('health_metrics');
    // Returns count of deleted rows
    expect(result.deletedRows).toBe(5);
  });

  it('handles case when no data exists to delete', async () => {
    const supabase = buildMockSupabase([], 0);
    const result = await revokeConsent('user-1', 'weight', supabase as never);
    expect(result.deletedRows).toBe(0);
  });
});

describe('grantedMetricTypes', () => {
  it('returns only granted metric types', async () => {
    const consents = [
      { user_id: 'user-1', metric_type: 'steps',         granted: true,  consent_version: 1, granted_at: null, revoked_at: null },
      { user_id: 'user-1', metric_type: 'blood_glucose', granted: false, consent_version: 1, granted_at: null, revoked_at: new Date().toISOString() },
      { user_id: 'user-1', metric_type: 'heart_rate',    granted: true,  consent_version: 1, granted_at: null, revoked_at: null },
    ];
    const supabase = buildMockSupabase(consents as never);
    const granted = await grantedMetricTypes('user-1', supabase as never);
    expect(granted).toContain('steps');
    expect(granted).toContain('heart_rate');
    expect(granted).not.toContain('blood_glucose');
  });
});
