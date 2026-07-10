// Shared "explain real tool results in natural language" helper — Phase 13. Every specialist
// agent's LAST step (§16.1.1: "Agents orchestrate and explain. Engines compute"): the LLM is
// given the REAL tool-call results already computed and asked only to phrase them naturally, in
// the user's language — it never computes a number itself (the Output Guard's numeric-claim
// validator, agents/output-guard.ts, is the backstop if one ever tries to).
//
// LLM-first, deterministic-template fallback when no gateway is configured — the same pattern
// already established in this codebase (pantry/receipt-ocr.ts, biomarker/lab-ocr-parser.ts) for
// exactly this reason: this environment has no LLM provider key, so the fallback is what
// actually runs and must be real, not a placeholder.

import type { GatewayRouter } from '../gateway/router.js';

export interface ExplainInput {
  gateway: GatewayRouter | null;
  systemPrompt: string;
  userMessage: string;
  /** Deterministic, template-based explanation built directly from the same real tool results
   *  the LLM prompt embeds — used verbatim when no gateway is configured, and as the basis the
   *  LLM is asked to phrase more naturally when one is. */
  templateFallback: string;
  locale?: string;
}

export async function explainWithFallback(input: ExplainInput): Promise<string> {
  if (!input.gateway) return input.templateFallback;

  try {
    const response = await input.gateway.complete({
      tier: 'copilot_reasoning',
      complexityHint: 'low',
      traceId: crypto.randomUUID(),
      systemPrompt: `${input.systemPrompt}\n\nRespond in the language matching locale "${input.locale ?? 'en-IN'}". Only use the numbers given below — never compute or estimate a new one.`,
      messages: [
        { role: 'user', content: input.userMessage },
        { role: 'assistant', content: `[Real computed data]\n${input.templateFallback}` },
      ],
    });
    return response.content || input.templateFallback;
  } catch {
    return input.templateFallback;
  }
}
