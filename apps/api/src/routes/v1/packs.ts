// Regional food pack routes — Phase 9 (`global.p9.incremental_regional_sync`).
// GET /v1/packs               — manifest of all known regional packs (real item counts/availability)
// GET /v1/packs/:packId/sync  — incremental sync: pass ?version=<cached> to get an empty,
//                               up-to-date result when nothing's changed, or the current full
//                               snapshot otherwise (see packs/sync-service.ts for why a
//                               versioned-whole-dataset sync is "incremental" this way).

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPackManifest, syncPack } from '../../packs/sync-service.js';
import { PackNotFoundError } from '../../packs/types.js';
import { ok, err } from '@nutrimind/shared';

export default async function packRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/packs', async (_request: FastifyRequest, reply: FastifyReply) => {
    const manifest = getPackManifest({ ifct: fastify.ifct, cofid: fastify.cofid });
    return reply.send(ok({ packs: manifest }));
  });

  fastify.get<{ Params: { packId: string }; Querystring: { version?: string } }>(
    '/packs/:packId/sync',
    async (request, reply) => {
      try {
        const result = syncPack(
          request.params.packId,
          request.query.version,
          { ifct: fastify.ifct, cofid: fastify.cofid },
        );
        return reply.send(ok(result));
      } catch (e) {
        if (e instanceof PackNotFoundError) {
          return reply.status(404).send(err('PACK_NOT_FOUND', e.message));
        }
        throw e;
      }
    },
  );
}
