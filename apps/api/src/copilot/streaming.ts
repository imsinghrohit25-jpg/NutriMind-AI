// Streaming response — wraps the gateway complete() call for SSE streaming.
// The copilot route sends Server-Sent Events so Flutter can render incremental text.
// Format: data: {"delta": "..."}\n\n  then  data: {"done": true, "citations": [...]}\n\n

import type { FastifyReply } from 'fastify';
import type { GatewayRouter } from '../gateway/router.js';
import type { RetrievedChunk } from '../knowledge/retrieval/hybrid.js';

export interface CopilotStreamOptions {
  systemPrompt:      string;
  messages:          Array<{ role: 'user' | 'assistant'; content: string }>;
  retrievedChunks:   RetrievedChunk[];
  traceId:           string;
  maxTokens?:        number;
}

export async function streamCopilotResponse(
  opts: CopilotStreamOptions,
  gateway: GatewayRouter,
  reply: FastifyReply,
): Promise<string> {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');

  // Non-streaming: call complete() and stream the whole response at once.
  // True streaming (gateway.stream()) is a Phase 10 enhancement.
  const response = await gateway.complete({
    tier: 'copilot_reasoning',
    messages: opts.messages,
    systemPrompt: opts.systemPrompt,
    traceId: opts.traceId,
    maxTokens: opts.maxTokens ?? 1024,
    temperature: 0.2,
  });

  const fullText = response.content;

  // Send the complete response as a single delta (simulated streaming)
  const delta = JSON.stringify({ delta: fullText });
  reply.raw.write(`data: ${delta}\n\n`);

  // Send citations
  const citations = opts.retrievedChunks.slice(0, 5).map((c) => ({
    chunkId: c.chunkId,
    title:   c.title,
    source:  c.source,
    year:    c.year,
  }));
  const done = JSON.stringify({ done: true, citations });
  reply.raw.write(`data: ${done}\n\n`);
  reply.raw.end();

  return fullText;
}
