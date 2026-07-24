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
import supabasePlugin from './plugins/supabase.js';
import countryPlugin from './country/plugin.js';
import { registerV1Routes } from './routes/v1/index.js';
import { buildRouter, type GatewayRouter } from './gateway/router.js';
import { CostLogger } from './gateway/cost-log.js';
import { GatewayCache } from './gateway/cache.js';
import { SemanticCache } from './gateway/semantic-cache.js';
import { GatewayBackpressure } from './gateway/backpressure.js';
import { isKillSwitchActive } from './gateway/cost-governance.js';
import { OpenFoodFactsClient } from './datasources/openfoodfacts/client.js';
import { UsdaFdcClient } from './datasources/usda/client.js';
import { IfctLoader } from './datasources/ifct/loader.js';
import { CofidLoader } from './datasources/cofid/loader.js';
import { EdgeCache } from './cache/edge-cache.js';
import type { CanonicalProduct } from './nutrition/canonical-model.js';

declare module 'fastify' {
  interface FastifyInstance {
    gateway: GatewayRouter | null;
    sql: postgres.Sql;
    offClient: OpenFoodFactsClient;
    usdaClient: UsdaFdcClient | null;
    ifct: IfctLoader;
    cofid: CofidLoader;
    productCache: EdgeCache<CanonicalProduct>;
    /** Google Cloud Vision — OCR text extraction only (Gemini/Vision integration). null when
     *  GOOGLE_VISION_API_KEY isn't configured; consumers must treat that as "path unavailable",
     *  same as `gateway: null`. */
    googleVisionApiKey: string | null;
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
  await fastify.register(supabasePlugin);
  await fastify.register(authPlugin);
  await fastify.register(rbacPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(otelPlugin);
  await fastify.register(countryPlugin);

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
      routerOptions: {
        semanticCache: new SemanticCache(),
        backpressure: new GatewayBackpressure(),
        killSwitch: () => isKillSwitchActive(fastify.supabase),
      },
    });
  }
  fastify.decorate('gateway', gateway);
  fastify.decorate('googleVisionApiKey', env.GOOGLE_VISION_API_KEY ?? null);

  // Phase 3 — datasource clients
  const offClient = new OpenFoodFactsClient(env.OFF_BASE_URL, env.OFF_USER_AGENT);
  fastify.decorate('offClient', offClient);

  const usdaClient = env.USDA_FDC_API_KEY ? new UsdaFdcClient(env.USDA_FDC_API_KEY) : null;
  fastify.decorate('usdaClient', usdaClient);

  // Phase 7 — in-process edge cache in front of the DB-backed product cache
  fastify.decorate('productCache', new EdgeCache<CanonicalProduct>());

  const ifct = new IfctLoader();
  await ifct.load(env.IFCT_DATASET_PATH);
  if (!ifct.isAvailable()) {
    fastify.log.warn('[ifct] IFCT 2017 dataset not loaded — IFCT resolution step will be skipped');
  } else {
    fastify.log.info('[ifct] IFCT 2017 dataset loaded');
  }
  fastify.decorate('ifct', ifct);

  // Phase 9 — regional pack sync needs CofidLoader decorated the same way ifct is; previously
  // only country-waterfall.ts (itself not wired into any route) constructed one ad hoc.
  const cofid = new CofidLoader();
  await cofid.load();
  fastify.decorate('cofid', cofid);

  await registerV1Routes(fastify);

  fastify.addHook('onClose', async () => {
    await sql.end();
  });

  return fastify;
}
