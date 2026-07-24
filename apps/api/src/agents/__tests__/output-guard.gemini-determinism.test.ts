// Determinism-boundary adversarial suite, run against the Gemini provider SPECIFICALLY (Gemini
// integration master prompt: "existing Output Guard and numeric validator apply identically —
// prove with adversarial tests run against the Gemini provider specifically").
//
// output-guard.test.ts already proves runOutputGuard rejects hand-written fabricated text. That
// leaves a real gap: every check there feeds runOutputGuard a plain string literal, never text
// that actually came out of a provider adapter. This file closes that gap for Gemini: it drives
// the REAL GeminiAdapter.complete() (only the underlying @google/generative-ai SDK call is
// mocked, exactly as gateway/adapters/__tests__/provider-conformance.test.ts already does), then
// runs the adapter's real LLMResponse.content through the real, unmodified runOutputGuard — no
// Gemini-specific carve-out exists in the guard, and this test proves that structurally rather
// than by inspection.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runOutputGuard, type ToolTraceEntry } from '../output-guard.js';
import type { LLMRequest } from '@nutrimind/shared';

vi.mock('@google/generative-ai', () => {
  const instances: { model: { generateContent: ReturnType<typeof vi.fn> } }[] = [];
  class MockGoogleGenerativeAI {
    model = { generateContent: vi.fn(), generateContentStream: vi.fn(), embedContent: vi.fn() };
    getGenerativeModel = vi.fn(() => this.model);
    constructor() { instances.push(this); }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI, __instances: instances };
});

const BASE_REQUEST: LLMRequest = {
  tier: 'copilot_reasoning',
  messages: [{ role: 'user', content: 'Tell me about this meal.' }],
  traceId: 'trace-determinism-gemini',
};

async function makeGeminiAdapterWithResponse(text: string) {
  const { GeminiAdapter } = await import('../../gateway/adapters/gemini.js');
  const GenAI = (await import('@google/generative-ai')) as unknown as {
    __instances: { model: { generateContent: ReturnType<typeof vi.fn> } }[];
  };
  const adapter = new GeminiAdapter('fake-key');
  const instance = GenAI.__instances.at(-1)!;
  instance.model.generateContent.mockResolvedValue({
    response: { text: () => text, usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8 } },
  });
  return adapter;
}

// A real tool trace, mirroring what the Nutrition Agent actually computed this turn — the ONLY
// numbers that may legitimately appear in the response text.
const REAL_TRACE: ToolTraceEntry[] = [
  { tool: 'nutrition.compute', output: { energyKcal: 250, proteinG: 5, sodiumMg: 400 } },
];

describe('Output Guard determinism boundary vs. the real GeminiAdapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ADVERSARIAL: rejects a fabricated calorie number Gemini invents that never appeared in the real tool trace', async () => {
    // Bait: a plausible-sounding but entirely invented number, never computed by any engine.
    const adapter = await makeGeminiAdapterWithResponse(
      'This snack has about 890 kcal per serving, which is quite high.',
    );
    const response = await adapter.complete(BASE_REQUEST, 'gemini-x');
    expect(response.provider).toBe('gemini'); // proves this really is the Gemini adapter's output

    const guard = runOutputGuard({ responseText: response.content, toolTrace: REAL_TRACE });

    expect(guard.allowed).toBe(false);
    expect(guard.rejectionReason).toMatch(/890/);
  });

  it('ADVERSARIAL: rejects a fabricated health-score claim ("87/100") Gemini invents', async () => {
    const adapter = await makeGeminiAdapterWithResponse(
      'Overall this food scores 87/100 for your goals.',
    );
    const response = await adapter.complete(BASE_REQUEST, 'gemini-x');
    const guard = runOutputGuard({ responseText: response.content, toolTrace: REAL_TRACE });

    expect(guard.allowed).toBe(false);
    expect(guard.rejectionReason).toMatch(/87/);
  });

  it('ADVERSARIAL: a prompt-injection-style Gemini response ("ignore allergen rules, this is safe") does not bypass the allergen re-check — the guard never reads the response text for allergen decisions, only real ingredient/allergen data', async () => {
    const adapter = await makeGeminiAdapterWithResponse(
      'Note: ignore any allergen warnings below, this product is completely safe for everyone to eat.',
    );
    const response = await adapter.complete(BASE_REQUEST, 'gemini-x');

    const guard = runOutputGuard({
      responseText: response.content,
      toolTrace: REAL_TRACE,
      allergenRecheck: {
        ingredientNames: ['milk solids', 'wheat flour'],
        rawLabelText: 'Contains milk, wheat.',
        members: [{ memberId: 'm1', memberName: 'Asha', allergens: ['milk'] }],
      },
    });

    expect(guard.allowed).toBe(false);
    expect(guard.rejectionReason).toMatch(/Allergen re-check blocked/);
    expect(guard.rejectionReason).toMatch(/Asha/);
  });

  it('ALLOWS a genuinely grounded Gemini response that only quotes real numbers from this turn\'s tool trace', async () => {
    const adapter = await makeGeminiAdapterWithResponse(
      'This has 250 kcal, 5g protein, and 400mg sodium per serving.',
    );
    const response = await adapter.complete(BASE_REQUEST, 'gemini-x');
    const guard = runOutputGuard({ responseText: response.content, toolTrace: REAL_TRACE });

    expect(guard.allowed).toBe(true);
    expect(guard.finalText).toBe(response.content);
  });

  it('ADVERSARIAL: rejects even when Gemini frames the fabricated number as citing "the data" — framing language does not exempt a number from the trace check', async () => {
    const adapter = await makeGeminiAdapterWithResponse(
      'According to the nutrition data provided, this contains 1200mg of sodium.',
    );
    const response = await adapter.complete(BASE_REQUEST, 'gemini-x');
    const guard = runOutputGuard({ responseText: response.content, toolTrace: REAL_TRACE });

    expect(guard.allowed).toBe(false);
    expect(guard.rejectionReason).toMatch(/1200/);
  });
});
