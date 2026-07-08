// Voice platform routes — Phase 15.
// POST /api/v1/voice/parse — transcribed text → structured NLU result + TTS response

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { GatewayRouter } from '../../gateway/router.js';
import { parseVoiceUtterance } from '../../voice/nlu.js';
import { buildScoreResponse, buildMealLogResponse, buildNoDataResponse } from '../../voice/tts.js';
import { resolveLocale } from '../../i18n/language.js';

type AuthedRequest = FastifyRequest & { userId?: string };

export async function registerVoiceRoutes(
  fastify:  FastifyInstance,
  gateway:  GatewayRouter,
): Promise<void> {

  // Parse transcribed speech → structured intent + TTS response
  fastify.post('/api/v1/voice/parse', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const body = req.body as { text: string; context?: string };
    if (!body?.text?.trim()) return reply.code(400).send({ error: 'text required' });

    const locale = resolveLocale(req.headers['accept-language']);
    const nlu    = await parseVoiceUtterance({ text: body.text, locale, gateway });

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
