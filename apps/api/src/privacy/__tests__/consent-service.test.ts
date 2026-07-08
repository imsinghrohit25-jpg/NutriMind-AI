import { describe, it, expect, vi } from 'vitest';
import { recordConsent, withdrawConsent, getConsentHistory, getConsentStatus } from '../consent-service.js';

function buildMockSupabase(rows: Array<{ consent_type: string; version: string; granted: boolean; accepted_at: string }> = []) {
  const insertResult = { data: null, error: null };
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve(insertResult)),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
        })),
      })),
    })),
  };
}

describe('recordConsent', () => {
  it('inserts a granted=true row into user_consents', async () => {
    const supabase = buildMockSupabase();
    await recordConsent(supabase as never, 'user-1', 'privacy', 'v1');
    expect(supabase.from).toHaveBeenCalledWith('user_consents');
    const insertCall = supabase.from.mock.results[0]!.value.insert;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', consent_type: 'privacy', version: 'v1', granted: true }),
    );
  });

  it('captures ip address and user agent when provided', async () => {
    const supabase = buildMockSupabase();
    await recordConsent(supabase as never, 'user-1', 'marketing', 'v1', { ipAddress: '1.2.3.4', userAgent: 'test-agent' });
    const insertCall = supabase.from.mock.results[0]!.value.insert;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({ ip_address: '1.2.3.4', user_agent: 'test-agent' }),
    );
  });
});

describe('withdrawConsent', () => {
  it('inserts a granted=false row', async () => {
    const supabase = buildMockSupabase();
    await withdrawConsent(supabase as never, 'user-1', 'marketing', 'v1');
    const insertCall = supabase.from.mock.results[0]!.value.insert;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({ consent_type: 'marketing', granted: false }),
    );
  });
});

describe('getConsentHistory', () => {
  it('returns the full event log oldest-first', async () => {
    const rows = [
      { consent_type: 'privacy', version: 'v1', granted: true, accepted_at: '2026-01-01T00:00:00Z' },
      { consent_type: 'marketing', version: 'v1', granted: true, accepted_at: '2026-02-01T00:00:00Z' },
      { consent_type: 'marketing', version: 'v1', granted: false, accepted_at: '2026-03-01T00:00:00Z' },
    ];
    const supabase = buildMockSupabase(rows);
    const history = await getConsentHistory(supabase as never, 'user-1');
    expect(history).toHaveLength(3);
    expect(history[2]!.granted).toBe(false);
  });
});

describe('getConsentStatus', () => {
  it('resolves the latest event per consent type', async () => {
    const rows = [
      { consent_type: 'privacy', version: 'v1', granted: true, accepted_at: '2026-01-01T00:00:00Z' },
      { consent_type: 'marketing', version: 'v1', granted: true, accepted_at: '2026-02-01T00:00:00Z' },
      { consent_type: 'marketing', version: 'v1', granted: false, accepted_at: '2026-03-01T00:00:00Z' },
    ];
    const supabase = buildMockSupabase(rows);
    const status = await getConsentStatus(supabase as never, 'user-1');

    const marketing = status.find((s) => s.consentType === 'marketing')!;
    expect(marketing.granted).toBe(false); // latest event wins — the withdrawal

    const privacy = status.find((s) => s.consentType === 'privacy')!;
    expect(privacy.granted).toBe(true);
  });

  it('returns an empty array for a user with no consent history', async () => {
    const supabase = buildMockSupabase([]);
    const status = await getConsentStatus(supabase as never, 'user-1');
    expect(status).toEqual([]);
  });
});
