// Country Intelligence Fastify plugin.
// Decorates every request with request.country: CountryProfile.
// When global.p1.country_engine flag is OFF, always returns INDIA_PROFILE (backward compat).

import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CountryProfile } from './types.js';
import { INDIA_PROFILE } from './types.js';
import { resolveCountry } from './resolution-chain.js';

const FLAG_KEY = 'global.p1.country_engine';
const FLAG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level flag cache — refreshed at most every 5 minutes.
let _flagEnabled: boolean  = false;
let _cacheExpiry: number   = 0;

async function isFlagEnabled(supabase: SupabaseClient): Promise<boolean> {
  if (Date.now() < _cacheExpiry) return _flagEnabled;

  try {
    const { data } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', FLAG_KEY)
      .is('country_code', null)       // global row
      .maybeSingle();

    _flagEnabled = data?.enabled ?? false;
  } catch {
    // DB failure: keep last value; don't break every request
    _flagEnabled = false;
  }

  _cacheExpiry = Date.now() + FLAG_CACHE_TTL_MS;
  return _flagEnabled;
}

declare module 'fastify' {
  interface FastifyRequest {
    country: CountryProfile;
  }
}

const countryPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('country', null as unknown as CountryProfile);

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const supabase = (fastify as any).supabase as SupabaseClient;

    if (!supabase) {
      // Supabase not yet available (test environment or early startup)
      request.country = INDIA_PROFILE;
      return;
    }

    const enabled = await isFlagEnabled(supabase);
    request.country = resolveCountry(request, enabled);

    request.log.debug(
      { country: request.country.isoCode, flagEnabled: enabled },
      '[country] resolved',
    );
  });
};

export default fp(countryPlugin, { name: 'country', dependencies: ['auth'] });

/** Reset the flag cache — for testing only. */
export function _resetFlagCache(): void {
  _flagEnabled = false;
  _cacheExpiry = 0;
}
