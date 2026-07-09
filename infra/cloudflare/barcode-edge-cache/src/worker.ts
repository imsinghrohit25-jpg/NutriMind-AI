// NutriMind barcode edge cache — Phase 12 (§13.1: "edge-first resolution: Cloudflare Worker +
// KV cache (barcode->food_id) before origin; cache hit target >= 90%").
//
// Scope: ONLY POST /v1/resolve/barcode is intercepted. Every other path/method passes straight
// through to origin untouched — this Worker is a barcode-specific accelerator, not a general
// reverse proxy, and must never risk caching an authenticated/personalized response.
//
// Known, accepted gap (documented, not fabricated as solved): origin's route handler
// (routes/v1/resolve.ts) records a `barcode_scanned` memory event and enqueues curation-queue
// work as a side effect of every request that reaches it. A cache HIT here never reaches origin,
// so that side effect does not fire for cache hits — the same tradeoff any CDN-fronted API takes
// (analytics decoupled from the cached response), not something this Worker silently hides.
//
// Never cached: non-2xx responses, and the origin's own `found:false` (barcode not resolved) —
// mirrors resolution/waterfall.ts's in-process EdgeCache, which the code comments there already
// document as "negative (not_found) results intentionally never cached" (curation-queue entries
// must keep firing for every genuinely-unresolved scan, not just the first).

export interface Env {
  BARCODE_KV: KVNamespace;
  ORIGIN_BASE_URL: string;
  CACHE_TTL_SECONDS: string;
}

const TARGET_PATH = '/v1/resolve/barcode';

function cacheKey(barcode: string, countryHeader: string | null): string {
  // Country-aware key (§13.2) — CofidLoader/IfctLoader resolution differs per CountryProfile
  // (ADR-0016), so the same barcode can legitimately resolve to different canonical data
  // per country; caching without this would silently serve the wrong country's product.
  const country = (countryHeader ?? 'GLOBAL').toUpperCase();
  return `barcode:v1:${country}:${barcode}`;
}

async function readBarcodeFromBody(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { barcode?: unknown };
    return typeof body.barcode === 'string' ? body.barcode : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== 'POST' || url.pathname !== TARGET_PATH) {
      return fetch(request);
    }

    const barcode = await readBarcodeFromBody(request);
    if (!barcode) {
      // Malformed body — let origin produce the real 400 VALIDATION_ERROR rather than guessing.
      return fetch(request);
    }

    const countryHeader = request.headers.get('x-nutrimind-country');
    const key = cacheKey(barcode, countryHeader);

    const cached = await env.BARCODE_KV.get(key, { type: 'json' });
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-edge-cache': 'HIT' },
      });
    }

    const originResponse = await fetch(request);

    // Only cache real, successful, positively-resolved responses — never auth errors, never
    // not-found, never 5xx.
    if (originResponse.ok) {
      try {
        const cloned = originResponse.clone();
        const payload = (await cloned.json()) as { data?: { found?: boolean } };
        if (payload?.data?.found === true) {
          await env.BARCODE_KV.put(key, JSON.stringify(payload), {
            expirationTtl: Number(env.CACHE_TTL_SECONDS) || 86400,
          });
        }
      } catch {
        // Non-JSON or unexpected shape — pass through without caching rather than guess.
      }
    }

    const response = new Response(originResponse.body, originResponse);
    response.headers.set('x-edge-cache', 'MISS');
    return response;
  },
};
