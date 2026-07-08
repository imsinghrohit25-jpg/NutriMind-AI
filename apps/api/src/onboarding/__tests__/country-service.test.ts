import { describe, it, expect, vi } from 'vitest';
import { getCountrySuggestion, setPreferredCountry, UnknownCountryError } from '../country-service.js';
import { INDIA_PROFILE } from '../../country/types.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.update = vi.fn(self);
  chain.eq = vi.fn(() => Promise.resolve(resolved));
  return chain;
}

describe('getCountrySuggestion', () => {
  it('returns the resolved profile as the suggestion and the full registry as the picker list', () => {
    const result = getCountrySuggestion(INDIA_PROFILE);
    expect(result.suggested.isoCode).toBe('IN');
    expect(result.countries.length).toBeGreaterThanOrEqual(25);
    expect(result.countries.map((c) => c.isoCode)).toContain('GB');
  });
});

describe('setPreferredCountry', () => {
  it('persists preferred_country and detected_country to users_profiles', async () => {
    const supabase = { from: vi.fn(() => makeChainable({})) };
    const profile = await setPreferredCountry(supabase as never, 'user-1', 'GB', 'IN');

    expect(profile.isoCode).toBe('GB');
    expect(supabase.from).toHaveBeenCalledWith('users_profiles');
    const chainable = supabase.from.mock.results[0]!.value;
    expect(chainable.update).toHaveBeenCalledWith({ preferred_country: 'GB', detected_country: 'IN' });
    expect(chainable.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws UnknownCountryError for an unregistered isoCode, without touching the database', async () => {
    const supabase = { from: vi.fn(() => makeChainable({})) };
    await expect(setPreferredCountry(supabase as never, 'user-1', 'ZZ', 'IN')).rejects.toThrow(UnknownCountryError);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws a descriptive error when the update fails', async () => {
    const supabase = { from: vi.fn(() => makeChainable({ error: { message: 'db down' } })) };
    await expect(setPreferredCountry(supabase as never, 'user-1', 'US', 'IN')).rejects.toThrow(/db down/);
  });
});
