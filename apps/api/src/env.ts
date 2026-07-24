import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadEnv } from './load-env.js';
import { z } from 'zod';

loadEnv(dirname(fileURLToPath(import.meta.url)));

// .env.example ships every optional var blank (e.g. `OPENAI_COMPAT_BASE_URL=`) — a blank value
// must mean "not set", not "set to the invalid empty string". Only needed for optional fields
// with an extra constraint beyond bare string (.url()/.positive()); a plain `.string().optional()`
// already accepts "" without complaint.
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  API_ENV: z.string().default('development'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  // Google Cloud Vision — OCR text extraction only (Gemini/Vision integration). Optional, same
  // pattern as every other provider key: absent means the Vision OCR path is simply never used,
  // never a startup failure.
  GOOGLE_VISION_API_KEY: z.string().optional(),
  OPENAI_COMPAT_BASE_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  OPENAI_COMPAT_API_KEY: z.string().optional(),
  LLM_ROUTING_CONFIG: z.string().default('config/routing.json'),
  LLM_MONTHLY_BUDGET_USD: z.preprocess(blankToUndefined, z.coerce.number().positive().optional()),

  USDA_FDC_API_KEY: z.string().optional(),
  OFF_BASE_URL: z.string().url().default('https://world.openfoodfacts.org'),
  OFF_USER_AGENT: z.string().default('NutriMindAI/0.1 (contact: imsinghrohit25@gmail.com)'),
  OFF_CACHE_TTL_HOURS: z.coerce.number().int().positive().default(168),
  IFCT_DATASET_PATH: z.string().default('data/ifct2017'),

  RATE_LIMIT_USER_PER_MIN: z.coerce.number().int().positive().default(60),
  CORS_ALLOWED_ORIGINS: z.string().default(''),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  OTEL_SERVICE_NAME: z.string().default('nutrimind-api'),
  SENTRY_DSN: z.string().optional(),
});

function parseEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${missing}`);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = typeof env;
