import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { INDIA_PROFILE } from '../../../country/types.js';

function makeSupabase(flags: Record<string, boolean>) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: (_col: string, key: string) => ({
          is: () => ({
            maybeSingle: () => Promise.resolve({ data: { enabled: flags[key] ?? false }, error: null }),
          }),
        }),
      }),
    })),
  };
}

async function buildApp(opts: {
  visionOcrFlagEnabled: boolean;
  googleVisionApiKey?: string | null;
  gatewayComplete?: (...args: unknown[]) => Promise<unknown>;
}): Promise<FastifyInstance> {
  const {
    default: scanRoutes,
    _resetScansUnifiedFoodSchemaFlagCache,
    _resetGeminiLabelEnrichmentFlagCache,
    _resetGoogleVisionOcrFlagCache,
  } = await import('../scans.js');
  _resetScansUnifiedFoodSchemaFlagCache();
  _resetGeminiLabelEnrichmentFlagCache();
  _resetGoogleVisionOcrFlagCache();

  const app = Fastify({ logger: false });
  app.decorate(
    'supabase',
    makeSupabase({
      'global.p14.google_vision_ocr': opts.visionOcrFlagEnabled,
      'global.p14.gemini_label_enrichment': false,
      'global.p3.unified_food_schema': true,
    }) as never,
  );
  app.decorate('sql', vi.fn().mockResolvedValue([]) as never);
  app.decorate('gateway', { complete: vi.fn(opts.gatewayComplete ?? (async () => ({ content: '{}' }))) } as never);
  app.decorate('googleVisionApiKey', opts.googleVisionApiKey === undefined ? 'fake-vision-key' : opts.googleVisionApiKey);
  app.decorate('offClient', { getProduct: vi.fn(), searchByName: vi.fn().mockResolvedValue([]) } as never);
  app.decorate('usdaClient', null as never);
  app.decorate('ifct', { isAvailable: () => false, searchByName: () => [], toCanonicalProduct: vi.fn() } as never);
  app.decorate('cofid', { isAvailable: () => false, searchByName: () => [], toCanonicalProduct: vi.fn() } as never);
  app.decorateRequest('country', null as never);
  app.addHook('onRequest', async (request: FastifyRequest) => { request.country = INDIA_PROFILE; });
  await app.register(scanRoutes, { prefix: '/v1' });
  await app.ready();
  return app;
}

function mockVisionFetch(body: unknown, ok = true): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

// No onDeviceOcrText at all — Step 1 is skipped entirely, forcing the cloud-OCR-fallback branch
// (Step 2), where the new Vision OCR path is wired in.
const PAYLOAD = { imageBase64: 'x'.repeat(200) };

const originalFetch = global.fetch;

describe('POST /v1/scans/label — Google Vision OCR (flag global.p14.google_vision_ocr)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { global.fetch = originalFetch; });

  it('flag OFF (default): never calls Vision (fetch), falls through to the unchanged gateway-based cloud-OCR path', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const app = await buildApp({ visionOcrFlagEnabled: false });

    const resp = await app.inject({ method: 'POST', url: '/v1/scans/label', payload: PAYLOAD });

    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(body.data).not.toHaveProperty('usedGoogleVisionOcr');
    expect(body.data.usedCloudOcr).toBe(true);
    await app.close();
  });

  it('flag ON but no key configured: never calls Vision, falls through unchanged (byte-identical to flag-off)', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const app = await buildApp({ visionOcrFlagEnabled: true, googleVisionApiKey: null });

    const resp = await app.inject({ method: 'POST', url: '/v1/scans/label', payload: PAYLOAD });

    expect(resp.statusCode).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    const body = JSON.parse(resp.body);
    expect(body.data).not.toHaveProperty('usedGoogleVisionOcr');
    await app.close();
  });

  it('flag ON + key configured: uses real Vision-extracted text, parsed by the same deterministic parseLabelText()', async () => {
    mockVisionFetch({
      responses: [{ fullTextAnnotation: { text: 'Poha\nEnergy 250 kcal\nProtein 5g\nCarbohydrates 40g' } }],
    });
    const app = await buildApp({ visionOcrFlagEnabled: true });

    const resp = await app.inject({ method: 'POST', url: '/v1/scans/label', payload: PAYLOAD });

    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data.usedGoogleVisionOcr).toBe(true);
    expect(body.data.usedCloudOcr).toBe(true);
    expect(body.data.needsUserConfirmation).toBe(true);
    expect(body.data.nutrition.energyKcal).toBe(250);
    expect(body.data.nutrition.proteinG).toBe(5);
    await app.close();
  });

  it('flag ON, Vision finds no text: falls through to the unchanged gateway-based cloud-OCR path (never a dead end)', async () => {
    mockVisionFetch({ responses: [{}] });
    const gatewayComplete = vi.fn(async () => ({
      content: JSON.stringify({ energyKcal: 100, confidence: 0.5 }),
    }));
    const app = await buildApp({ visionOcrFlagEnabled: true, gatewayComplete });

    const resp = await app.inject({ method: 'POST', url: '/v1/scans/label', payload: PAYLOAD });

    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data).not.toHaveProperty('usedGoogleVisionOcr');
    expect(body.data.usedCloudOcr).toBe(true);
    expect(gatewayComplete).toHaveBeenCalled(); // real fallback to the existing LLM-based path
    await app.close();
  });

  it('flag ON, Vision network call throws: falls through gracefully to the unchanged gateway-based cloud-OCR path, never 500s', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const gatewayComplete = vi.fn(async () => ({
      content: JSON.stringify({ energyKcal: 100, confidence: 0.5 }),
    }));
    const app = await buildApp({ visionOcrFlagEnabled: true, gatewayComplete });

    const resp = await app.inject({ method: 'POST', url: '/v1/scans/label', payload: PAYLOAD });

    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data).not.toHaveProperty('usedGoogleVisionOcr');
    expect(gatewayComplete).toHaveBeenCalled();
    await app.close();
  });
});
