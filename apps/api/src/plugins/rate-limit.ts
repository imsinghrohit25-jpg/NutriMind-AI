import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { env } from '../env.js';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: env.RATE_LIMIT_USER_PER_MIN,
    timeWindow: 60_000,
    keyGenerator(request) {
      return request.user?.id ?? request.ip ?? 'anonymous';
    },
    errorResponseBuilder(_request, context) {
      return {
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)}s.`,
          details: { retryAfterMs: context.ttl },
        },
      };
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit', dependencies: ['auth'] });
