import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import postgres from 'postgres';
import { env } from './env.js';
import authPlugin from './plugins/auth.js';
import rbacPlugin from './plugins/rbac.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import otelPlugin from './plugins/otel.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import { registerV1Routes } from './routes/v1/index.js';
import { buildRouter, type GatewayRouter } from './gateway/router.js';
import { CostLogger } from './gateway/cost-log.js';
import { GatewayCache } from './gateway/cache.js';

declare module 'fastify' {
  interface FastifyInstance {
    gateway: GatewayRouter | null;
    sql: postgres.Sql;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      serializers: {
        req(req) {
          return { method: req.method, url: req.url, id: req.id };
        },
      },
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: env.CORS_ALLOWED_ORIGINS
      ? env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : false,
    credentials: true,
  });

  await fastify.register(errorHandlerPlugin);
  await fastify.register(authPlugin);
  await fastify.register(rbacPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(otelPlugin);

  const sql = postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  fastify.decorate('sql', sql);

  const costLogger = new CostLogger(sql);
  const cache = new GatewayCache();

  let gateway: GatewayRouter | null = null;
  const hasAnyKey =
    env.ANTHROPIC_API_KEY ||
    env.OPENAI_API_KEY ||
    env.GEMINI_API_KEY ||
    env.OPENAI_COMPAT_BASE_URL;

  if (hasAnyKey) {
    gateway = buildRouter({
      anthropicKey: env.ANTHROPIC_API_KEY,
      openaiKey: env.OPENAI_API_KEY,
      geminiKey: env.GEMINI_API_KEY,
      openaiCompatBaseUrl: env.OPENAI_COMPAT_BASE_URL,
      openaiCompatKey: env.OPENAI_COMPAT_API_KEY,
      routingConfigPath: env.LLM_ROUTING_CONFIG,
      costLogger,
      cache,
    });
  }
  fastify.decorate('gateway', gateway);

  await registerV1Routes(fastify);

  fastify.addHook('onClose', async () => {
    await sql.end();
  });

  return fastify;
}
