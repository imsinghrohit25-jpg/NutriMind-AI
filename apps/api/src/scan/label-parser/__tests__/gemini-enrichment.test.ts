import { describe, it, expect, vi } from 'vitest';
import { enrichLabelWithGemini, extractSearchQueryHeuristic } from '../gemini-enrichment.js';
import type { ParsedLabel } from '../parser.js';
import type { NutritionCitation } from '../../../nutrition/citation.js';
import type { GatewayRouter } from '../../../gateway/router.js';

function makeParsedLabel(overrides: Partial<ParsedLabel> = {}): ParsedLabel {
  return {
    nutrition: { energyKcal: 250, proteinG: 5 },
    fieldConfidence: { energyKcal: 'high', proteinG: 'high' },
    servingSizeG: 30,
    wasPerServing: false,
    overallConfidence: 0.9,
    lowConfidenceFields: [],
    labelFormat: 'generic',
    ...overrides,
  };
}

function makeCitation(): NutritionCitation {
  return {
    source: 'ifct_2017',
    sourceDisplay: 'Indian Food Composition Tables 2017',
    licenseClass: 'public_domain',
    attributionText: 'ICMR-NIN',
    termsUrl: null,
    datasetVersion: '2017',
    importBatchId: 'batch-1',
    sourceFoodId: 'food-1',
    dataQualityGrade: 'A',
    valueStateNotes: [],
  };
}

function makeGateway(completeImpl: (...args: unknown[]) => Promise<unknown>): GatewayRouter {
  return { complete: vi.fn(completeImpl) } as unknown as GatewayRouter;
}

const baseOpts = {
  imageBase64: 'x'.repeat(200),
  imageMediaType: 'image/jpeg' as const,
  ocrText: 'Maggi Noodles\nEnergy 250 kcal\nProtein 5g',
  parsedLabel: makeParsedLabel(),
  citation: null,
  matchedProductName: null,
  locale: 'en-IN',
  traceId: 'trace-1',
};

describe('enrichLabelWithGemini', () => {
  it('returns a real enrichment result on a well-formed model response', async () => {
    const gateway = makeGateway(async () => ({
      content: JSON.stringify({
        foodName: 'Maggi 2-Minute Noodles',
        brandGuess: 'Nestle',
        ingredientInterpretation: 'Wheat-based instant noodles with a seasoning packet.',
        allergenCandidates: ['wheat', 'soy'],
        servingContextNote: 'One pack serves one person.',
        explanation: 'A popular instant noodle snack.',
        confidence: 0.85,
      }),
    }));

    const result = await enrichLabelWithGemini({ ...baseOpts, gateway });

    expect(result.available).toBe(true);
    expect(result.aiEnriched).toBe(true);
    expect(result.foodName).toBe('Maggi 2-Minute Noodles');
    expect(result.brandGuess).toBe('Nestle');
    expect(result.allergenCandidates).toEqual(['wheat', 'soy']);
    expect(result.confidence).toBe(0.85);
    expect(result.note).toBeNull();
  });

  it('passes the matched citation context through to the model prompt, never restating its numbers itself', async () => {
    let seenSystemPrompt = '';
    let seenUserMessage = '';
    const gateway = makeGateway(async (req: unknown) => {
      const r = req as { systemPrompt: string; messages: { content: string }[] };
      seenSystemPrompt = r.systemPrompt;
      seenUserMessage = r.messages[0]!.content;
      return { content: JSON.stringify({ foodName: 'X', confidence: 0.5 }) };
    });

    await enrichLabelWithGemini({
      ...baseOpts,
      citation: makeCitation(),
      matchedProductName: 'Poha',
      gateway,
    });

    expect(seenSystemPrompt).toContain('NEVER state, estimate, or restate any nutrition number');
    expect(seenUserMessage).toContain('Poha');
    expect(seenUserMessage).toContain('Indian Food Composition Tables 2017');
  });

  it('strips any nutrition-number key the model includes anyway (determinism-boundary defense)', async () => {
    const gateway = makeGateway(async () => ({
      content: JSON.stringify({
        foodName: 'Suspicious Food',
        confidence: 0.5,
        energyKcal: 999, // adversarial: model tries to inject a nutrition number
        sodiumMg: 1234,
      }),
    }));

    const result = await enrichLabelWithGemini({ ...baseOpts, gateway });

    expect(result).not.toHaveProperty('energyKcal');
    expect(result).not.toHaveProperty('sodiumMg');
    expect(JSON.stringify(result)).not.toContain('999');
    expect(JSON.stringify(result)).not.toContain('1234');
  });

  it('degrades gracefully (available: false, honest note) when the gateway call throws', async () => {
    const gateway = makeGateway(async () => {
      throw new Error('gateway unavailable');
    });

    const result = await enrichLabelWithGemini({ ...baseOpts, gateway });

    expect(result.available).toBe(false);
    expect(result.aiEnriched).toBe(false);
    expect(result.note).toMatch(/unavailable/i);
    expect(result.foodName).toBeNull();
  });

  it('degrades gracefully when the model returns malformed JSON (e.g. safety-blocked/empty response)', async () => {
    const gateway = makeGateway(async () => ({ content: 'not json at all' }));

    const result = await enrichLabelWithGemini({ ...baseOpts, gateway });

    expect(result.available).toBe(false);
    expect(result.note).toMatch(/not valid JSON/i);
  });

  it('strips a fenced ```json code block before parsing', async () => {
    const gateway = makeGateway(async () => ({
      content: '```json\n' + JSON.stringify({ foodName: 'Fenced', confidence: 0.4 }) + '\n```',
    }));

    const result = await enrichLabelWithGemini({ ...baseOpts, gateway });
    expect(result.foodName).toBe('Fenced');
  });

  it('filters out non-string entries from allergenCandidates rather than trusting the shape blindly', async () => {
    const gateway = makeGateway(async () => ({
      content: JSON.stringify({ foodName: 'X', confidence: 0.5, allergenCandidates: ['milk', 42, null, 'soy'] }),
    }));

    const result = await enrichLabelWithGemini({ ...baseOpts, gateway });
    expect(result.allergenCandidates).toEqual(['milk', 'soy']);
  });

  it('clamps confidence to [0, 1]', async () => {
    const gateway = makeGateway(async () => ({
      content: JSON.stringify({ foodName: 'X', confidence: 5 }),
    }));
    const result = await enrichLabelWithGemini({ ...baseOpts, gateway });
    expect(result.confidence).toBe(1);
  });
});

describe('extractSearchQueryHeuristic', () => {
  it('returns the first non-empty line of the OCR text', () => {
    expect(extractSearchQueryHeuristic('Maggi Noodles\nEnergy 250 kcal')).toBe('Maggi Noodles');
  });

  it('skips leading blank lines', () => {
    expect(extractSearchQueryHeuristic('\n  \nReal Product Name\nNutrition Facts')).toBe('Real Product Name');
  });

  it('skips lines shorter than 3 characters (likely noise, not a product name)', () => {
    expect(extractSearchQueryHeuristic('X\n1\nActual Name Here')).toBe('Actual Name Here');
  });

  it('returns null when there is no usable line', () => {
    expect(extractSearchQueryHeuristic('\n\nX\nY\n')).toBeNull();
  });
});
