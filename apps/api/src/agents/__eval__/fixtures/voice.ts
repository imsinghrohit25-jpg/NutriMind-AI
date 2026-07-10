import { vi } from 'vitest';
import type { ToolContext } from '../../types.js';
import type { AgentEvalCase } from '../types.js';

function makeGateway(content: string) {
  return {
    complete: vi.fn(async () => ({
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

export const VOICE_EVAL_CASES: AgentEvalCase[] = [
  {
    id: 'voice-no-gateway-honest',
    agent: 'voice',
    description: 'reports honestly when no AI gateway is configured for NLU parsing',
    message: 'do roti khaya',
    buildCtx: () => makeCtx(null),
    expect: { responseIncludes: ["isn't configured"] },
  },
  {
    id: 'voice-low-confidence-asks-one-clarifying-question',
    agent: 'voice',
    description: 'asks ONE clarifying question, never a silent guess, when NLU confidence is below the real threshold',
    message: 'mumble mumble',
    buildCtx: () => makeCtx(makeGateway(JSON.stringify({ intent: 'log_meal', foods: [], confidence: 0.3 }))),
    expect: { responseIncludes: ["didn't quite catch"], handoffStateIncludes: { voiceAmbiguous: true } },
  },
  {
    id: 'voice-high-confidence-builds-confirmation-no-tool-call',
    agent: 'voice',
    description: 'builds a real confirmation utterance from a high-confidence Hinglish food-logging parse — calls no tool itself (empty allowlist)',
    message: 'do roti khaya lunch me',
    buildCtx: () => makeCtx(makeGateway(JSON.stringify({
      intent: 'log_meal', mealType: 'lunch', confidence: 0.9,
      foods: [{ name: 'roti', nameRaw: 'do roti', quantity: 2, unit: 'piece' }],
    }))),
    expect: { responseIncludes: ['confirm'] },
  },
  {
    id: 'voice-non-logging-intent-normalized-handoff',
    agent: 'voice',
    description: 'normalizes a non-logging intent (score query) into structured handoff state rather than free text',
    message: 'maggi ka score kya hai',
    buildCtx: () => makeCtx(makeGateway(JSON.stringify({
      intent: 'query_score', confidence: 0.85, foods: [{ name: 'maggi', nameRaw: 'maggi', quantity: 1, unit: 'packet' }],
    }))),
    expect: { handoffStateIncludes: { normalizedMessage: 'maggi', voiceIntent: 'query_score' } },
  },
];
