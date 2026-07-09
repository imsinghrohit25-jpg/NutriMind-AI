import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, { type Env } from '../src/worker.js';

function makeFakeKV() {
  const store = new Map<string, { value: string; ttl?: number }>();
  return {
    get: vi.fn(async (key: string, opts?: { type?: string }) => {
      const entry = store.get(key);
      if (!entry) return null;
      return opts?.type === 'json' ? JSON.parse(entry.value) : entry.value;
    }),
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, { value, ttl: opts?.expirationTtl });
    }),
    _store: store,
  };
}

function makeEnv(): Env & { BARCODE_KV: ReturnType<typeof makeFakeKV> } {
  return {
    // The fake only implements get/put — the only two KVNamespace methods worker.ts calls.
    BARCODE_KV: makeFakeKV() as unknown as Env['BARCODE_KV'],
    ORIGIN_BASE_URL: 'https://api.nutrimind.ai',
    CACHE_TTL_SECONDS: '86400',
  } as Env & { BARCODE_KV: ReturnType<typeof makeFakeKV> };
}

const FOUND_RESPONSE = {
  ok: true,
  data: { found: true, resolvedBy: 'off', product: { id: 'p1', name: 'Maggi Noodles' } },
  meta: { requestId: 'r1', version: 'v1' },
};

const NOT_FOUND_RESPONSE = {
  ok: true,
  data: { found: false, curationQueueId: 'c1', message: 'Product not found. A curation entry has been created.' },
  meta: { requestId: 'r2', version: 'v1' },
};

describe('barcode edge cache worker', () => {
  let originFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originFetch = vi.fn();
    vi.stubGlobal('fetch', originFetch);
  });

  it('passes non-target paths straight through to origin', async () => {
    originFetch.mockResolvedValueOnce(new Response('ok'));
    const request = new Request('https://api.nutrimind.ai/v1/resolve/name', { method: 'POST', body: '{}' });

    await worker.fetch(request, makeEnv());

    expect(originFetch).toHaveBeenCalledOnce();
  });

  it('passes GET requests to the target path straight through', async () => {
    originFetch.mockResolvedValueOnce(new Response('ok'));
    const request = new Request('https://api.nutrimind.ai/v1/resolve/barcode', { method: 'GET' });

    await worker.fetch(request, makeEnv());

    expect(originFetch).toHaveBeenCalledOnce();
  });

  it('on a cold cache, forwards to origin and caches a found:true response', async () => {
    originFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(FOUND_RESPONSE), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const env = makeEnv();
    const request = new Request('https://api.nutrimind.ai/v1/resolve/barcode', {
      method: 'POST',
      body: JSON.stringify({ barcode: '8901058851074' }),
      headers: { 'x-nutrimind-country': 'IN' },
    });

    const response = await worker.fetch(request, env);
    const body = await response.json();

    expect(response.headers.get('x-edge-cache')).toBe('MISS');
    expect(body).toEqual(FOUND_RESPONSE);
    expect(env.BARCODE_KV.put).toHaveBeenCalledOnce();
    expect(env.BARCODE_KV.put.mock.calls[0][0]).toBe('barcode:v1:IN:8901058851074');
  });

  it('serves a subsequent identical lookup from KV without touching origin', async () => {
    const env = makeEnv();
    await env.BARCODE_KV.put('barcode:v1:IN:8901058851074', JSON.stringify(FOUND_RESPONSE), { expirationTtl: 86400 });

    const request = new Request('https://api.nutrimind.ai/v1/resolve/barcode', {
      method: 'POST',
      body: JSON.stringify({ barcode: '8901058851074' }),
      headers: { 'x-nutrimind-country': 'IN' },
    });

    const response = await worker.fetch(request, env);
    const body = await response.json();

    expect(response.headers.get('x-edge-cache')).toBe('HIT');
    expect(body).toEqual(FOUND_RESPONSE);
    expect(originFetch).not.toHaveBeenCalled();
  });

  it('never caches a not-found response', async () => {
    originFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(NOT_FOUND_RESPONSE), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const env = makeEnv();
    const request = new Request('https://api.nutrimind.ai/v1/resolve/barcode', {
      method: 'POST',
      body: JSON.stringify({ barcode: '0000000000000' }),
    });

    await worker.fetch(request, env);

    expect(env.BARCODE_KV.put).not.toHaveBeenCalled();
  });

  it('never caches an error response from origin', async () => {
    originFetch.mockResolvedValueOnce(new Response('server error', { status: 500 }));
    const env = makeEnv();
    const request = new Request('https://api.nutrimind.ai/v1/resolve/barcode', {
      method: 'POST',
      body: JSON.stringify({ barcode: '1234567890123' }),
    });

    await worker.fetch(request, env);

    expect(env.BARCODE_KV.put).not.toHaveBeenCalled();
  });

  it('different countries for the same barcode are cached separately', async () => {
    const env = makeEnv();
    await env.BARCODE_KV.put('barcode:v1:IN:8901058851074', JSON.stringify(FOUND_RESPONSE), {});

    const request = new Request('https://api.nutrimind.ai/v1/resolve/barcode', {
      method: 'POST',
      body: JSON.stringify({ barcode: '8901058851074' }),
      headers: { 'x-nutrimind-country': 'US' },
    });
    originFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(FOUND_RESPONSE), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const response = await worker.fetch(request, env);

    expect(response.headers.get('x-edge-cache')).toBe('MISS');
    expect(originFetch).toHaveBeenCalledOnce();
  });

  it('passes through a malformed body without guessing a barcode', async () => {
    originFetch.mockResolvedValueOnce(new Response('ok'));
    const request = new Request('https://api.nutrimind.ai/v1/resolve/barcode', {
      method: 'POST',
      body: 'not json',
    });

    await worker.fetch(request, makeEnv());

    expect(originFetch).toHaveBeenCalledOnce();
  });
});
