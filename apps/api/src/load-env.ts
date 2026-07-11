// Loads the repo-root .env explicitly (found while wiring up GEMINI_API_KEY/GOOGLE_VISION_API_KEY
// locally): local dev always runs with cwd = apps/api (npm workspaces execute a workspace's
// scripts from that workspace's own directory, whether invoked as `cd apps/api && npm run dev`
// or `npm run dev --workspace=apps/api` from the root), but .env/.env.example live at the repo
// root (next to the Dockerfile's WORKDIR) — so a bare `dotenv/config()`'s default cwd-relative
// lookup silently found nothing there, and none of the optional provider keys (or any required
// SUPABASE_*/DATABASE_URL value) ever actually loaded from a real local .env.
//
// Searches upward from the caller's own directory for a `.env` file rather than hardcoding a
// fixed relative depth, since that depth differs between dev (this file runs as TS source,
// 3 directories below the repo root) and the compiled dist tree (an extra apps/api/src nesting —
// see server.ts's own Dockerfile CMD comment for that exact prior bug class). Production never
// actually has a .env file at all (env vars are injected directly by the deployment platform), so
// there this is a harmless no-op, identical to dotenv's own previous default behavior.
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function findRepoRootEnv(startDir: string): string | undefined {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parentDir = dirname(dir);
    if (parentDir === dir) return undefined; // reached filesystem root, nothing found
    dir = parentDir;
  }
}

/** Call with `dirname(fileURLToPath(import.meta.url))` from the caller's own module. */
export function loadEnv(callerDir: string): void {
  const found = findRepoRootEnv(callerDir);
  dotenv.config(found ? { path: found } : undefined);
}
