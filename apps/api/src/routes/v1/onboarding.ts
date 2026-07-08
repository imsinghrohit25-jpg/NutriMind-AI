// Country onboarding v2 routes — Phase 10 (`global.p10.country_onboarding_v2`).
// GET  /v1/onboarding/country  — auto-detected suggestion + full country picker list
// POST /v1/onboarding/country  — persist the user's explicit choice

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { GLOBAL_PROFILE, type CountryProfile } from '../../country/types.js';
import { getCountrySuggestion, setPreferredCountry, UnknownCountryError } from '../../onboarding/country-service.js';
import { ok, err } from '@nutrimind/shared';

const CountryBodySchema = z.object({
  isoCode: z.string().min(2).max(10),
});

function resolvedCountry(request: FastifyRequest): CountryProfile {
  return (request as { country?: CountryProfile }).country ?? GLOBAL_PROFILE;
}

export default async function onboardingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/onboarding/country', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(ok(getCountrySuggestion(resolvedCountry(request))));
  });

  fastify.post<{ Body: unknown }>('/onboarding/country', async (request, reply) => {
    requireAuth(request);
    const body = CountryBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }

    try {
      const profile = await setPreferredCountry(
        fastify.supabase,
        request.user.id,
        body.data.isoCode,
        resolvedCountry(request).isoCode,
      );
      return reply.send(ok({ profile }));
    } catch (e) {
      if (e instanceof UnknownCountryError) {
        return reply.status(400).send(err('UNKNOWN_COUNTRY', e.message));
      }
      throw e;
    }
  });
}
