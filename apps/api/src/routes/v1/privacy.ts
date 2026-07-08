// Privacy consent routes — Phase 8 (`global.p8.gdpr_consent_flow`, `dpdp_consent_flow`).
// GET  /api/v1/privacy/regime            — resolved regime + structured consent requirements
// GET  /api/v1/privacy/consent           — current per-consent-type status
// POST /api/v1/privacy/consent           — record a consent grant
// POST /api/v1/privacy/consent/withdraw  — record a consent withdrawal

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { privacyRegimeFor, consentRequirementsFor, ALL_CONSENT_TYPES } from '../../privacy/regime.js';
import { recordConsent, withdrawConsent, getConsentStatus } from '../../privacy/consent-service.js';
import { ok, err } from '@nutrimind/shared';

const ConsentBodySchema = z.object({
  consentType: z.enum(ALL_CONSENT_TYPES as [string, ...string[]]),
  version: z.string().min(1).max(50),
});

function resolveCountryCode(request: FastifyRequest): string {
  return (request as { country?: { isoCode?: string } }).country?.isoCode ?? 'GLOBAL';
}

export default async function privacyRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/privacy/regime
  fastify.get('/privacy/regime', {}, async (request: FastifyRequest, reply: FastifyReply) => {
    const regime = privacyRegimeFor(resolveCountryCode(request));
    return reply.send(ok({ regime, requirements: consentRequirementsFor(regime) }));
  });

  // GET /api/v1/privacy/consent
  fastify.get('/privacy/consent', {}, async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);
    const status = await getConsentStatus(fastify.supabase, request.user.id);
    return reply.send(ok({ status }));
  });

  // POST /api/v1/privacy/consent
  fastify.post<{ Body: unknown }>('/privacy/consent', async (request, reply) => {
    requireAuth(request);
    const body = ConsentBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    try {
      await recordConsent(
        fastify.supabase,
        request.user.id,
        body.data.consentType as (typeof ALL_CONSENT_TYPES)[number],
        body.data.version,
        { ipAddress: request.ip, userAgent: request.headers['user-agent'] },
      );
    } catch (e) {
      return reply.status(500).send(err('CONSENT_RECORD_FAILED', e instanceof Error ? e.message : 'unknown error'));
    }
    return reply.send(ok({ recorded: true }));
  });

  // POST /api/v1/privacy/consent/withdraw
  fastify.post<{ Body: unknown }>('/privacy/consent/withdraw', async (request, reply) => {
    requireAuth(request);
    const body = ConsentBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    try {
      await withdrawConsent(
        fastify.supabase,
        request.user.id,
        body.data.consentType as (typeof ALL_CONSENT_TYPES)[number],
        body.data.version,
        { ipAddress: request.ip, userAgent: request.headers['user-agent'] },
      );
    } catch (e) {
      return reply.status(500).send(err('CONSENT_WITHDRAW_FAILED', e instanceof Error ? e.message : 'unknown error'));
    }
    return reply.send(ok({ withdrawn: true }));
  });
}
