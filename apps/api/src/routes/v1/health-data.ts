// Health Data Platform routes — Phase 13.
// POST /api/v1/health/metrics/upload  — mobile → server batch upload (HealthKit/Health Connect)
// GET  /api/v1/health/metrics         — fetch user's health metrics
// GET  /api/v1/health/consents        — get consent state for all metric types
// POST /api/v1/health/consents/grant  — grant per-type consent
// POST /api/v1/health/consents/revoke — revoke + delete data
// GET  /api/v1/health/energy-adjustment — today's adjustment for daily dashboard
// POST /api/v1/health/oauth/fitbit/callback — exchange Fitbit auth code
// POST /api/v1/health/oauth/garmin/callback — exchange Garmin auth code
// DELETE /api/v1/health/oauth/:provider    — disconnect provider

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { upsertHealthMetrics } from '../../health/dedup.js';
import { grantConsent, revokeConsent, getConsents } from '../../health/consent.js';
import { computeEnergyAdjustment } from '../../health/energy-adjustment.js';
import { exchangeFitbitCode } from '../../health/providers/fitbit.js';
import { exchangeGarminCode } from '../../health/providers/garmin.js';
import type { HealthMetric, MetricType, SourcePlatform } from '../../health/types.js';
import type { ActivityLevel } from '../../engines/personalization/targets.js';

type AuthedRequest = FastifyRequest & { userId?: string };

export async function registerHealthDataRoutes(
  fastify:  FastifyInstance,
  supabase: SupabaseClient,
): Promise<void> {

  // Upload batch of metrics from on-device platforms (HealthKit / Health Connect)
  fastify.post('/api/v1/health/metrics/upload', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const body = req.body as {
      metrics: Array<{
        metricType:     string;
        value:          number;
        unit:           string;
        startTime:      string;
        endTime?:       string;
        sourcePlatform: string;
        sourceDevice?:  string;
        externalId:     string;
        syncBatch?:     string;
      }>;
    };

    if (!Array.isArray(body?.metrics) || body.metrics.length === 0) {
      return reply.code(400).send({ error: 'metrics array required' });
    }

    const metrics: HealthMetric[] = body.metrics.map((m) => ({
      userId,
      metricType:     m.metricType     as MetricType,
      value:          m.value,
      unit:           m.unit,
      startTime:      new Date(m.startTime),
      endTime:        m.endTime ? new Date(m.endTime) : undefined,
      sourcePlatform: m.sourcePlatform as SourcePlatform,
      sourceDevice:   m.sourceDevice,
      externalId:     m.externalId,
      syncBatch:      m.syncBatch,
    }));

    const result = await upsertHealthMetrics(metrics, supabase);
    return reply.send(result);
  });

  // Fetch health metrics
  fastify.get('/api/v1/health/metrics', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const { metricType, from, to, limit } = req.query as {
      metricType?: string; from?: string; to?: string; limit?: string;
    };

    let query = supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(parseInt(limit ?? '100', 10));

    if (metricType) query = query.eq('metric_type', metricType);
    if (from)       query = query.gte('start_time', from);
    if (to)         query = query.lte('start_time', to);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ metrics: data });
  });

  // Consent state
  fastify.get('/api/v1/health/consents', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });
    const consents = await getConsents(userId, supabase);
    return reply.send({ consents });
  });

  fastify.post('/api/v1/health/consents/grant', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });
    const { metricType } = req.body as { metricType: MetricType };
    if (!metricType) return reply.code(400).send({ error: 'metricType required' });
    await grantConsent(userId, metricType, supabase);
    return reply.send({ granted: true, metricType });
  });

  fastify.post('/api/v1/health/consents/revoke', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });
    const { metricType } = req.body as { metricType: MetricType };
    if (!metricType) return reply.code(400).send({ error: 'metricType required' });
    const result = await revokeConsent(userId, metricType, supabase);
    return reply.send({ revoked: true, metricType, deletedRows: result.deletedRows });
  });

  // Energy adjustment for daily dashboard
  fastify.get('/api/v1/health/energy-adjustment', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const { tdee, activityLevel, date } = req.query as {
      tdee?: string; activityLevel?: string; date?: string;
    };

    if (!tdee || !activityLevel) {
      return reply.code(400).send({ error: 'tdee and activityLevel required' });
    }

    const today       = date ?? new Date().toISOString().slice(0, 10);
    const startOfDay  = new Date(today + 'T00:00:00Z');
    const endOfDay    = new Date(today + 'T23:59:59Z');

    const { data: energyRows } = await supabase
      .from('health_metrics')
      .select('value')
      .eq('user_id', userId)
      .eq('metric_type', 'active_energy')
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString());

    const measured = (energyRows ?? []).reduce((s, r) => s + (r.value as number), 0);

    const result = computeEnergyAdjustment({
      tdeeKcal:           parseInt(tdee, 10),
      activityLevel:      activityLevel as ActivityLevel,
      measuredActiveKcal: Math.round(measured),
      date:               today,
    });

    return reply.send(result);
  });

  // Fitbit OAuth callback
  fastify.post('/api/v1/health/oauth/fitbit/callback', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const { code, redirectUri, codeVerifier } = req.body as {
      code: string; redirectUri: string; codeVerifier: string;
    };

    const tokens = await exchangeFitbitCode(code, redirectUri, codeVerifier);

    await supabase.from('oauth_tokens').upsert({
      user_id:          userId,
      provider:         'fitbit',
      access_token:     tokens.accessToken,
      refresh_token:    tokens.refreshToken,
      expires_at:       tokens.expiresAt.toISOString(),
      provider_user_id: tokens.providerUserId,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    return reply.send({ connected: true, provider: 'fitbit' });
  });

  // Garmin OAuth callback
  fastify.post('/api/v1/health/oauth/garmin/callback', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const { code, redirectUri } = req.body as { code: string; redirectUri: string };
    const tokens = await exchangeGarminCode(code, redirectUri);

    await supabase.from('oauth_tokens').upsert({
      user_id:       userId,
      provider:      'garmin',
      access_token:  tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at:    tokens.expiresAt.toISOString(),
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    return reply.send({ connected: true, provider: 'garmin' });
  });

  // Disconnect a provider
  fastify.delete('/api/v1/health/oauth/:provider', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });
    const { provider } = req.params as { provider: string };

    await supabase.from('oauth_tokens').delete()
      .eq('user_id', userId).eq('provider', provider);

    return reply.send({ disconnected: true, provider });
  });
}
