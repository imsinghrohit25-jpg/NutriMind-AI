import { describe, it, expect, vi } from 'vitest';
import { countryProfileTool, countryTransitionTool } from '../country.js';
import { UnknownCountryError } from '../../../onboarding/country-service.js';

describe('countryProfileTool', () => {
  it('resolves a real registered country', async () => {
    const profile = await countryProfileTool.execute({ isoCode: 'IN' }, {} as never);
    expect(profile.isoCode).toBe('IN');
  });

  it('throws UnknownCountryError for an unregistered code — never fabricates a profile', async () => {
    await expect(countryProfileTool.execute({ isoCode: 'ZZ' }, {} as never)).rejects.toThrow(UnknownCountryError);
  });
});

describe('countryTransitionTool', () => {
  it('persists the transition and emits a country_transition memory event', async () => {
    const updateSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'users_profiles') return { update: updateSpy };
        if (table === 'user_events') return { insert: insertSpy };
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const profile = await countryTransitionTool.execute(
      { toIsoCode: 'AE', fromIsoCode: 'IN' }, { supabase, userId: 'u1' } as never,
    );

    expect(profile.isoCode).toBe('AE');
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ preferred_country: 'AE' }));
  });
});
