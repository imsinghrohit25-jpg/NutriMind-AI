// Copilot orchestrator — the main RAG pipeline entry point.
// Flow: guardrails → retrieve → build prompt → LLM → verify grounding → respond.
// CRITICAL: Copilot CANNOT modify any score, nutrition, allergen, or ingredient field.
// The LLM here is explanation-only; all computed values come from engines/*.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';
import type { FastifyReply } from 'fastify';

import { checkGuardrails } from './guardrails.js';
import { verifyGrounding } from './grounding-verifier.js';
import { streamCopilotResponse } from './streaming.js';
import { appendTurn, buildHistoryMessages } from './memory.js';
import { hybridRetrieve, fetchChunks } from '../knowledge/retrieval/hybrid.js';

export interface CopilotRequest {
  userId:      string;
  traceId:     string;
  query:       string;
  // Optional product context injected by the UI when the user is on a product page
  productContext?: {
    productName:   string;
    healthScore:   number;
    scoreBand:     string;
    keyNutrients?: Record<string, number | string>;
  };
}

export interface CopilotRefusal {
  type:          'refusal';
  category:      string;
  message:       string;
  redirectNote?: string;
}

export type CopilotResponse = { type: 'stream' } | CopilotRefusal;

const COPILOT_SYSTEM_PROMPT = `You are NutriMind Health Copilot — a food literacy assistant for Indian consumers.
Your role is to help users understand nutrition labels, health scores, and healthy eating patterns.

STRICT RULES — you MUST follow these without exception:
1. DO NOT diagnose medical conditions. Say "consult your doctor" if asked.
2. DO NOT recommend specific medication dosages or drug interactions. Refuse and redirect.
3. DO NOT make up numerical values (e.g., "eat 45g protein per day"). Only cite numbers from the provided context chunks.
4. DO NOT claim food can cure or treat any disease. Use phrases like "may support" not "will cure".
5. DO acknowledge Indian dietary context (dal, roti, rice, ghee, spices) where relevant.
6. DO cite your sources at the end of your answer using [Source: title, year] format.
7. Keep answers concise (4–8 sentences). Avoid clinical jargon.
8. If you are unsure, say so rather than guessing.

All numerical thresholds you mention MUST come from the provided knowledge chunks below.
If the chunks do not contain the information needed to answer, say: "I don't have reliable information about that in my knowledge base."`;

export async function runCopilot(
  req: CopilotRequest,
  supabase: SupabaseClient,
  gateway: GatewayRouter,
  reply: FastifyReply,
): Promise<CopilotResponse> {
  // 1. Guardrails — check before any LLM call
  const guard = checkGuardrails(req.query);
  if (guard.blocked) {
    return {
      type:         'refusal',
      category:     guard.category ?? 'policy',
      message:      guard.refusalMessage ?? 'This question is outside what I can help with.',
      redirectNote: guard.redirectNote,
    };
  }

  // 2. Retrieve relevant knowledge chunks
  const chunks = await hybridRetrieve(req.query, supabase, gateway, { topK: 5 });
  const chunkIds = chunks.map((c) => c.chunkId).filter(Boolean);
  const fullChunks = await fetchChunks(chunkIds, supabase);

  // 3. Build prompt with retrieved context
  const contextText = fullChunks
    .map((c, i) => `[Chunk ${i + 1}: ${c.title} (${c.source}, ${c.year})]\n${c.text}`)
    .join('\n\n---\n\n');

  const productContextText = req.productContext
    ? `\n\nProduct context (user is viewing this product):\n` +
      `Product: ${req.productContext.productName}\n` +
      `Health Score: ${req.productContext.healthScore}/100 (${req.productContext.scoreBand})\n` +
      (req.productContext.keyNutrients
        ? Object.entries(req.productContext.keyNutrients)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n')
        : '')
    : '';

  const systemWithContext = `${COPILOT_SYSTEM_PROMPT}\n\n` +
    `KNOWLEDGE BASE CHUNKS (use ONLY these for numerical claims):\n\n${contextText}` +
    productContextText;

  // 4. Build message history
  const history = buildHistoryMessages(req.userId);
  appendTurn(req.userId, 'user', req.query);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history,
    { role: 'user', content: req.query },
  ];

  // 5. Stream LLM response
  const fullText = await streamCopilotResponse(
    {
      systemPrompt:    systemWithContext,
      messages,
      retrievedChunks: fullChunks,
      traceId:         req.traceId,
      maxTokens:       1024,
    },
    gateway,
    reply,
  );

  // 6. Grounding verification (async — logged but not blocking response)
  const grounding = verifyGrounding(fullText, fullChunks);
  if (!grounding.isGrounded) {
    // Log ungrounded violations; in Phase 10 these feed into eval reporting
    console.warn(`[copilot] Grounding violations for traceId=${req.traceId}:`, grounding.violations);
  }

  // 7. Persist assistant turn
  appendTurn(req.userId, 'assistant', fullText);

  return { type: 'stream' };
}
