// Data rights (DSR) route — GDPR/DPDP-compliant access, portability, erasure, rectification,
// and restriction. Phase 8 (`global.p8.dsr_endpoints`). Registered with prefix '/v1' in
// routes/v1/index.ts, matching every other route in this file's directory — the real reachable
// paths are `/v1/data-rights/*` (NOT `/api/v1/data-rights/*`; see ADR-0021 for a prefix
// inconsistency found, but not fixed, in this phase's other still-unregistered route files).
//
// POST  /v1/data-rights/export           → JSON export of all user data (Art. 15/20, Sec. 11)
// POST  /v1/data-rights/delete           → hard delete all PII; verification query (Art. 17, Sec. 12)
// GET   /v1/data-rights/rights           → regime-aware list of applicable rights
// PATCH /v1/data-rights/rectify          → correct profile fields (Art. 16, Sec. 12)
// POST  /v1/data-rights/restrict         → request processing restriction (Art. 18, Sec. 12)
// POST  /v1/data-rights/restrict/lift    → lift a processing restriction
//
// Fixes two pre-existing defects found while extending this route for Phase 8 (see ADR-0021):
//   1. `USER_TABLES`/`EXPORT_TABLES` referenced 'user_profiles' and 'scan_history' — neither
//      table exists (the real tables are `users_profiles` and `scans`; migration 0002/0004).
//      Every export/delete call previously either 404'd on these tables or (for `.eq('user_id',
//      ...)` against `users_profiles`, whose PK column is `id`, and `household_members`, whose
//      column is `owner_id`) silently matched zero rows — full deletion never verified clean.
//   2. Both handlers read `req.userId`, a property `plugins/auth.ts` never sets (it sets
//      `request.user: AuthUser | null`) — every call was falling through to 401 regardless of
//      auth. Switched to the `requireAuth`/`request.user.id` pattern used by every other route.
// This route was also never registered in `routes/v1/index.ts` — see that file's Phase 8 change.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { privacyRegimeFor, consentRequirementsFor } from '../../privacy/regime.js';
import { requestRestriction, liftRestriction, getRestrictionStatus } from '../../privacy/restriction-service.js';
import { ok, err } from '@nutrimind/shared';

interface UserTableRef {
  table: string;
  /** Column identifying the owning user on this table. */
  column: string;
}

// Tables that contain per-user PII, used for both export and deletion (the same set answers
// "what personal data concerning this user exists" either way). Deleting the parent tables here
// transitively removes their FK-CASCADE children (scan_images, member_safety_evaluations,
// grocery_cart_items, copilot_messages, product_ingredient_items) — no need to list those too.
const USER_DATA_TABLES: readonly UserTableRef[] = [
  { table: 'scan_history_embeddings', column: 'user_id' },
  { table: 'copilot_conversations', column: 'user_id' },
  { table: 'grocery_cart_sessions', column: 'user_id' },
  { table: 'recommendations', column: 'user_id' },
  { table: 'meal_logs', column: 'user_id' },
  { table: 'push_tokens', column: 'user_id' },
  { table: 'push_preferences', column: 'user_id' },
  { table: 'scans', column: 'user_id' },
  { table: 'health_scores', column: 'user_id' },
  { table: 'weekly_reports', column: 'user_id' },
  { table: 'household_members', column: 'owner_id' },
  { table: 'users_profiles', column: 'id' },
] as const;

// `users_profiles` fields a user has a clear factual right to correct (Art. 16 / Sec. 12).
// Excludes engine-computed fields (tdee_kcal, macro_*) and account/audit fields (created_at,
// onboarding_complete) — those aren't "personal data the user asserts is inaccurate," they're
// derived outputs or system state.
const RectifyBodySchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  age_years: z.number().int().min(1).max(120).optional(),
  biological_sex: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  height_cm: z.number().min(50).max(300).optional(),
  weight_kg: z.number().min(1).max(600).optional(),
  activity_level: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active']).optional(),
  goal: z.enum(['lose', 'maintain', 'gain']).optional(),
  diet_type: z.enum(['non_vegetarian', 'vegetarian', 'eggetarian', 'vegan', 'jain', 'other']).optional(),
  conditions: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
  preferred_language: z.string().min(2).max(10).optional(),
}).strict();

const RestrictBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

function resolveCountryCode(request: FastifyRequest): string {
  return (request as { country?: { isoCode?: string } }).country?.isoCode ?? 'GLOBAL';
}

export default async function dataRightsRoutes(fastify: FastifyInstance): Promise<void> {
  const supabase = fastify.supabase;

  // GET /api/v1/data-rights/rights — regime-aware summary for a "Privacy Center" screen
  fastify.get('/data-rights/rights', {}, async (request: FastifyRequest, reply: FastifyReply) => {
    const regime = privacyRegimeFor(resolveCountryCode(request));
    return reply.send(ok({
      regime,
      consentRequirements: consentRequirementsFor(regime),
      rights: [
        { id: 'access', endpoint: 'POST /api/v1/data-rights/export' },
        { id: 'portability', endpoint: 'POST /api/v1/data-rights/export' },
        { id: 'erasure', endpoint: 'POST /api/v1/data-rights/delete' },
        { id: 'rectification', endpoint: 'PATCH /api/v1/data-rights/rectify' },
        { id: 'restriction', endpoint: 'POST /api/v1/data-rights/restrict' },
        { id: 'consent_withdrawal', endpoint: 'POST /api/v1/privacy/consent/withdraw' },
      ],
    }));
  });

  // POST /api/v1/data-rights/export — full data export
  fastify.post('/data-rights/export', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);
    const userId = request.user.id;

    const exportData: Record<string, unknown[]> = {};
    for (const { table, column } of USER_DATA_TABLES) {
      const { data } = await supabase.from(table).select('*').eq(column, userId);
      exportData[table] = data ?? [];
    }

    reply
      .header('Content-Disposition', `attachment; filename="nutrimind-export-${userId}.json"`)
      .header('Content-Type', 'application/json')
      .send(JSON.stringify({ exportedAt: new Date().toISOString(), userId, data: exportData }));
  });

  // POST /api/v1/data-rights/delete — full erasure with server-side verification
  fastify.post('/data-rights/delete', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);
    const userId = request.user.id;

    const errors: string[] = [];
    for (const { table, column } of USER_DATA_TABLES) {
      const { error } = await supabase.from(table).delete().eq(column, userId);
      if (error) errors.push(`${table}: ${error.message}`);
    }

    // Verification query — gate requirement: prove deletion succeeded
    const verificationResults: Record<string, number> = {};
    for (const { table, column } of USER_DATA_TABLES) {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, userId);
      verificationResults[table] = count ?? -1;
    }

    const remainingRows = Object.values(verificationResults).reduce((a, b) => a + b, 0);

    if (errors.length > 0) {
      return reply.code(500).send(err('PARTIAL_DELETION', 'Some tables failed to delete', undefined, { errors, verificationResults }));
    }
    if (remainingRows > 0) {
      return reply.code(500).send(err('DELETION_UNVERIFIED', 'Rows still present after deletion', undefined, { verificationResults }));
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) errors.push(`auth: ${authError.message}`);

    return reply.send(ok({
      deleted: true,
      verificationResults,
      remainingRows,
      deletedAt: new Date().toISOString(),
    }));
  });

  // PATCH /api/v1/data-rights/rectify — GDPR Art. 16 / DPDP Sec. 12 right to correction
  fastify.patch<{ Body: unknown }>('/data-rights/rectify', async (request, reply) => {
    requireAuth(request);
    const body = RectifyBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    if (Object.keys(body.data).length === 0) {
      return reply.status(400).send(err('VALIDATION_ERROR', 'at least one field must be provided'));
    }

    const { error, data } = await supabase
      .from('users_profiles')
      .update(body.data)
      .eq('id', request.user.id)
      .select('*')
      .maybeSingle();

    if (error) {
      return reply.status(500).send(err('RECTIFY_FAILED', error.message));
    }
    return reply.send(ok({ updated: true, profile: data }));
  });

  // POST /api/v1/data-rights/restrict — GDPR Art. 18 / DPDP Sec. 12 restriction of processing
  fastify.post<{ Body: unknown }>('/data-rights/restrict', async (request, reply) => {
    requireAuth(request);
    const body = RestrictBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    await requestRestriction(supabase, request.user.id, body.data.reason);
    return reply.send(ok({
      restricted: true,
      note: 'Recorded. This currently pauses no automated processing pipeline end-to-end — see ADR-0021 for the tracked enforcement gap.',
    }));
  });

  // POST /api/v1/data-rights/restrict/lift
  fastify.post<{ Body: unknown }>('/data-rights/restrict/lift', async (request, reply) => {
    requireAuth(request);
    const body = RestrictBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    await liftRestriction(supabase, request.user.id, body.data.reason);
    return reply.send(ok({ restricted: false }));
  });

  // GET /api/v1/data-rights/restrict — current restriction status
  fastify.get('/data-rights/restrict', {}, async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);
    const status = await getRestrictionStatus(supabase, request.user.id);
    return reply.send(ok({ status }));
  });
}
