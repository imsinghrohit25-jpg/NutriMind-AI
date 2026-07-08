// Voice platform routes — Phase 15.
// Registered with prefix '/v1' in routes/v1/index.ts — real reachable path is `/v1/voice/parse`
// (this file previously hardcoded `/api/v1/voice/parse`, which never resolved to anything real;
// read a non-existent `req.userId`, so the handler always 401'd; and took a 2-arg
// `(fastify, gateway)` signature Fastify's `.register()` cannot supply. See ADR-0022.)
// POST /v1/voice/parse — transcribed text → structured NLU result + TTS response

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';
import { parseVoiceUtterance } from '../../voice/nlu.js';
import { buildMealLogResponse, buildNoDataResponse } from '../../voice/tts.js';
import { resolveLocale } from '../../i18n/language.js';

export default async function voiceRoutes(fastify: FastifyInstance): Promise<void> {

  // Parse transcribed speech → structured intent + TTS response
  fastify.post('/voice/parse', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);

    const body = req.body as { text: string; context?: string };
    if (!body?.text?.trim()) return reply.code(400).send({ error: 'text required' });

    if (!fastify.gateway) {
      return reply.status(503).send({ error: 'AI gateway not configured; set at least one LLM provider key' });
    }

    const locale = resolveLocale(req.headers['accept-language']);
    const nlu    = await parseVoiceUtterance({ text: body.text, locale, gateway: fastify.gateway });

    // Build TTS response based on intent
    let tts;
    if (nlu.intent === 'log_meal' && nlu.foods.length > 0) {
      tts = buildMealLogResponse({
        locale,
        foodNames: nlu.foods.map((f) => f.name),
        kcal:      0,  // Caller should enrich with actual kcal after database lookup
      });
    } else if (nlu.intent === 'query_score' && nlu.foods.length > 0) {
      tts = buildNoDataResponse(locale);  // Score lookup requires product DB call
    } else {
      tts = buildNoDataResponse(locale);
    }

    return reply.send({ nlu, tts });
  });
}
