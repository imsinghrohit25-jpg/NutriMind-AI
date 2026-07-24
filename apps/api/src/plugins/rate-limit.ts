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
      // `@fastify/rate-limit` throws this return value directly (see its index.js) rather than
      // calling reply.code()/send() itself, and our global error-handler plugin reads
      // `.statusCode`/`.code`/`.message` off the thrown value's TOP LEVEL (matching Fastify's own
      // FastifyError shape) to decide the response — nesting them under `.error` like the rest of
      // this codebase's response bodies do left all three unset, so the handler fell back to a
      // bare 500 with a generic message, which the mobile client then misread as a network/
      // offline failure instead of a rate limit. Found via a real device throwing repeated
      // identical barcode-resolve requests and getting "you're offline" instead of a proper
      // rate-limit message.
      return {
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)}s.`,
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
