import { describe, it, expect, vi } from 'vitest';
import { runVoiceAgent } from '../voice.js';
import type { ToolContext } from '../../types.js';

function makeGateway(content: string) {
  return {
    complete: vi.fn(async (_req: { messages: Array<{ content: string }> }) => ({
      content, provider: 'mock', model: 'mock', promptTokens: 1, completionTokens: 1,
      costUsd: 0, latencyMs: 1, cached: false, traceId: 'voice-nlu',
    })),
  };
}

function makeCtx(gateway: unknown): ToolContext {
  return {
    gateway: gateway as never, supabase: {} as never, userId: 'u1',
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
  };
}

describe('runVoiceAgent', () => {
  it('reports honestly when no AI gateway is configured', async () => {
    const ctx = makeCtx(null);
    const result = await runVoiceAgent({ message: 'do roti khaya', ctx, registry: {} as never, locale: 'hi-IN', handoffState: {} });
    expect(result.responseText).toMatch(/isn't configured/i);
  });

  it('asks ONE clarifying question, never a silent guess, when NLU confidence is below threshold', async () => {
    const gateway = makeGateway(JSON.stringify({ intent: 'log_meal', foods: [], confidence: 0.3 }));
    const ctx = makeCtx(gateway);
    const result = await runVoiceAgent({ message: 'mumble mumble', ctx, registry: {} as never, locale: 'hi-IN', handoffState: {} });
    expect(result.responseText).toMatch(/didn't quite catch/i);
    expect(result.handoffState).toEqual({ voiceAmbiguous: true });
  });

  it('builds a real confirmation utterance from a high-confidence Hinglish food-logging parse — calls no tool itself', async () => {
    const gateway = makeGateway(JSON.stringify({
      intent: 'log_meal', mealType: 'lunch', confidence: 0.9,
      foods: [{ name: 'roti', nameRaw: 'do roti', quantity: 2, unit: 'piece' }],
    }));
    const ctx = makeCtx(gateway);

    const result = await runVoiceAgent({ message: 'do roti khaya lunch me', ctx, registry: {} as never, locale: 'hi-IN', handoffState: {} });

    expect(result.responseText).toMatch(/2piece roti/i);
    expect(result.responseText).toMatch(/confirm/i);
    expect(result.toolTrace).toHaveLength(0);
    expect(result.handoffState!.pendingFoodLog).toBeDefined();
  });

  it('degrades an unrecognized locale (Tamil) to English NLU parsing rather than fabricating Tamil support', async () => {
    const gateway = makeGateway(JSON.stringify({ intent: 'log_meal', confidence: 0.9, foods: [{ name: 'idli', nameRaw: 'idli', quantity: 2, unit: 'piece' }] }));
    const ctx = makeCtx(gateway);

    await runVoiceAgent({ message: 'rendu idli sapten', ctx, registry: {} as never, locale: 'ta-IN', handoffState: {} });

    const call = gateway.complete.mock.calls[0]![0] as { messages: Array<{ content: string }> };
    expect(call.messages[0]!.content).toContain('Locale: en');
  });

  it('normalizes a non-logging intent (score query) into structured handoff state', async () => {
    const gateway = makeGateway(JSON.stringify({
      intent: 'query_score', confidence: 0.85, foods: [{ name: 'maggi', nameRaw: 'maggi', quantity: 1, unit: 'packet' }],
    }));
    const ctx = makeCtx(gateway);
    const result = await runVoiceAgent({ message: 'maggi ka score kya hai', ctx, registry: {} as never, locale: 'hi-IN', handoffState: {} });
    expect(result.handoffState).toEqual(expect.objectContaining({ normalizedMessage: 'maggi', voiceIntent: 'query_score' }));
  });
});
