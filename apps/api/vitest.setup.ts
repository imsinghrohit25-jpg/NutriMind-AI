// Global test setup — dummy env values so `env.ts`'s zod validation doesn't throw for any
// test that transitively imports it (e.g. any route test importing `plugins/auth.ts`'s
// `requireAuth`, which loads `createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL))` at module
// scope). `??=` never overrides a real value already set (local .env, CI secrets) — these are
// pure fallbacks so the test suite stays hermetic without one.
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.SUPABASE_JWKS_URL ??= 'http://localhost:54321/auth/v1/.well-known/jwks.json';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:54322/postgres';
