// Readiness endpoint — Phase 12 (§13.5 reliability). Distinct from /v1/health (liveness: "is the
// process alive," used by K8s to decide whether to RESTART a pod) — /v1/ready answers "should
// this pod currently receive traffic," used by K8s to decide whether to include it in the
// Service's load-balancing rotation. A transient DB blip should pull a pod out of rotation, not
// restart it (restarting fixes nothing when the problem is the database, not the process).
import type { FastifyPluginAsync } from 'fastify';
import type postgres from 'postgres';

const DB_PING_TIMEOUT_MS = 2000;

const readyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ready', {}, async (_request, reply) => {
    const dbCheck = await pingDatabase(fastify.sql, DB_PING_TIMEOUT_MS);

    if (!dbCheck.ok) {
      return reply.status(503).send({
        ok: false,
        data: { status: 'not_ready', reason: 'database_unreachable', detail: dbCheck.error },
      });
    }

    return reply.send({ ok: true, data: { status: 'ready' } });
  });
};

export async function pingDatabase(
  sql: postgres.Sql,
  timeoutMs: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await Promise.race([
      sql`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('db ping timeout')), timeoutMs)),
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export default readyRoutes;
