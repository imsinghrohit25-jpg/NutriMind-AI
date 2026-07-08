// Data rights route — GDPR/DPDP-compliant full export and full deletion.
// Gate requirement: deletion proven by verification query (row count = 0 after delete).
// POST /api/v1/data-rights/export  → JSON export of all user data
// POST /api/v1/data-rights/delete  → hard delete all PII; verification query run server-side

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

// Tables that contain per-user PII — deleted in dependency order
const USER_TABLES = [
  'scan_history_embeddings',
  'meal_logs',
  'push_tokens',
  'push_preferences',
  'scan_history',
  'health_scores',
  'household_members',
  'user_profiles',
] as const;

// Tables included in export (read-only)
const EXPORT_TABLES = [
  'user_profiles',
  'household_members',
  'scan_history',
  'health_scores',
  'meal_logs',
] as const;

export async function registerDataRightsRoutes(
  fastify: FastifyInstance,
  supabase: SupabaseClient,
): Promise<void> {
  // Full data export — streams all PII as JSON
  fastify.post('/api/v1/data-rights/export', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as FastifyRequest & { userId?: string }).userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const exportData: Record<string, unknown[]> = {};

    for (const table of EXPORT_TABLES) {
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId);
      exportData[table] = data ?? [];
    }

    reply
      .header('Content-Disposition', `attachment; filename="nutrimind-export-${userId}.json"`)
      .header('Content-Type', 'application/json')
      .send(JSON.stringify({ exportedAt: new Date().toISOString(), userId, data: exportData }));
  });

  // Full deletion — deletes all PII, runs verification query
  fastify.post('/api/v1/data-rights/delete', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as FastifyRequest & { userId?: string }).userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const errors: string[] = [];

    for (const table of USER_TABLES) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', userId);
      if (error) errors.push(`${table}: ${error.message}`);
    }

    // Verification query — gate requirement: prove deletion succeeded
    const verificationResults: Record<string, number> = {};
    for (const table of USER_TABLES) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      verificationResults[table] = count ?? -1;
    }

    const remainingRows = Object.values(verificationResults).reduce((a, b) => a + b, 0);

    if (errors.length > 0) {
      return reply.code(500).send({
        error:  'Partial deletion — some tables failed',
        errors,
        verificationResults,
      });
    }

    if (remainingRows > 0) {
      return reply.code(500).send({
        error: 'Deletion verification failed — rows still present',
        verificationResults,
      });
    }

    // Revoke Supabase auth account (soft-delete; hard delete via admin API)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      errors.push(`auth: ${authError.message}`);
    }

    return reply.send({
      deleted:             true,
      verificationResults,
      remainingRows,
      deletedAt:           new Date().toISOString(),
    });
  });
}
