// SSE streaming helper — Phase 13 (§16.2: "Streaming responses (SSE/WebSocket) to client,
// mandatory"). Pipes a real async event stream to a Fastify reply as genuine Server-Sent Events
// — one `data:` frame per event, flushed as it's produced, not buffered and sent as one chunk
// (the pre-Phase-13 copilot/streaming.ts pattern this replaces for the agent system).

import type { FastifyReply } from 'fastify';

export type AgentStreamEventType =
  | 'agent_started'
  | 'tool_call'
  | 'tool_result'
  | 'agent_handoff'
  | 'token'
  | 'guard_rejected'
  | 'done'
  | 'error';

export interface AgentStreamEvent {
  type: AgentStreamEventType;
  data: unknown;
}

export function startSse(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx response buffering, if fronted by one
  });
}

export function writeSseEvent(reply: FastifyReply, event: AgentStreamEvent): void {
  reply.raw.write(`event: ${event.type}\n`);
  reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);
}

export function endSse(reply: FastifyReply): void {
  reply.raw.end();
}

/** Drains an async generator of AgentStreamEvents to the client as real SSE, one frame per
 *  event — the generator itself decides pacing (e.g. one `token` event per real LLM chunk), this
 *  function only ever forwards what it's given, immediately, never batching. */
export async function pipeAgentStream(
  reply: FastifyReply,
  events: AsyncGenerator<AgentStreamEvent, void, void>,
): Promise<void> {
  startSse(reply);
  try {
    for await (const event of events) {
      writeSseEvent(reply, event);
    }
  } catch (err) {
    writeSseEvent(reply, { type: 'error', data: { message: err instanceof Error ? err.message : String(err) } });
  } finally {
    endSse(reply);
  }
}
