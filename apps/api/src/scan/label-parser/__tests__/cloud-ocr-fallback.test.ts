import { describe, it, expect } from 'vitest';
import { extractLabelViaCloudVision } from '../cloud-ocr-fallback.js';
import type { GatewayRouter } from '../../../gateway/router.js';

function fakeResponse(content: string) {
  return {
    content, provider: 'test', model: 'test-model',
    promptTokens: 10, completionTokens: 10, costUsd: 0,
    latencyMs: 1, cached: false, traceId: 'test-trace',
  };
}

function fakeGateway(content: string): GatewayRouter {
  return { complete: async () => fakeResponse(content) } as unknown as GatewayRouter;
}

function throwingGateway(): GatewayRouter {
  return { complete: async () => { throw new Error('provider down'); } } as unknown as GatewayRouter;
}

const VALID_JSON = JSON.stringify({
  energyKcal: 250, proteinG: 8, fatTotalG: 10, fatSaturatedG: 3, fatTransG: 0,
  carbohydratesG: 30, sugarsG: 12, fibreG: 2, sodiumMg: 400,
  servingSizeG: 100, isPerServing: false, confidence: 0.8,
});

describe('extractLabelViaCloudVision', () => {
  it('parses a well-formed JSON response and marks the source as cloud_ocr_llm', async () => {
    const result = await extractLabelViaCloudVision({
      imageBase64: 'fake', imageMediaType: 'image/jpeg',
      gateway: fakeGateway(VALID_JSON), traceId: 't1',
    });
    expect(result.nutrition.source).toBe('cloud_ocr_llm');
    expect(result.nutrition.energyKcal).toBe(250);
    expect(result.nutrition.sodiumMg).toBe(400);
  });

  it('caps confidence below what a clean deterministic match could earn, even when the model claims higher', async () => {
    const overconfident = JSON.stringify({ ...JSON.parse(VALID_JSON), confidence: 1.0 });
    const result = await extractLabelViaCloudVision({
      imageBase64: 'fake', imageMediaType: 'image/jpeg',
      gateway: fakeGateway(overconfident), traceId: 't2',
    });
    expect(result.overallConfidence).toBeLessThan(1.0);
    expect(result.overallConfidence).toBeLessThanOrEqual(0.6);
  });

  it('handles markdown code-fenced JSON', async () => {
    const fenced = '```json\n' + VALID_JSON + '\n```';
    const result = await extractLabelViaCloudVision({
      imageBase64: 'fake', imageMediaType: 'image/jpeg',
      gateway: fakeGateway(fenced), traceId: 't3',
    });
    expect(result.nutrition.energyKcal).toBe(250);
  });

  it('never throws when the gateway call fails — degrades to an empty, zero-confidence result', async () => {
    await expect(extractLabelViaCloudVision({
      imageBase64: 'fake', imageMediaType: 'image/jpeg',
      gateway: throwingGateway(), traceId: 't4',
    })).resolves.not.toThrow();

    const result = await extractLabelViaCloudVision({
      imageBase64: 'fake', imageMediaType: 'image/jpeg',
      gateway: throwingGateway(), traceId: 't5',
    });
    expect(result.overallConfidence).toBe(0);
    expect(result.nutrition.energyKcal).toBeNull();
  });

  it('never throws on malformed (non-JSON) model output', async () => {
    const result = await extractLabelViaCloudVision({
      imageBase64: 'fake', imageMediaType: 'image/jpeg',
      gateway: fakeGateway('not json at all'), traceId: 't6',
    });
    expect(result.overallConfidence).toBe(0);
  });

  it('flags null fields as absent and includes them in lowConfidenceFields', async () => {
    const partial = JSON.stringify({ energyKcal: 250, confidence: 0.7 });
    const result = await extractLabelViaCloudVision({
      imageBase64: 'fake', imageMediaType: 'image/jpeg',
      gateway: fakeGateway(partial), traceId: 't7',
    });
    expect(result.fieldConfidence['sodiumMg']).toBe('absent');
    expect(result.lowConfidenceFields).toContain('sodiumMg');
  });

  it('never claims a null value that the model did not provide (no fabrication)', async () => {
    const minimal = JSON.stringify({ confidence: 0.5 });
    const result = await extractLabelViaCloudVision({
      imageBase64: 'fake', imageMediaType: 'image/jpeg',
      gateway: fakeGateway(minimal), traceId: 't8',
    });
    expect(result.nutrition.energyKcal).toBeNull();
    expect(result.nutrition.proteinG).toBeNull();
  });
});
