import { describe, it, expect, vi } from 'vitest';
import { pipeAgentStream, type AgentStreamEvent } from '../sse.js';

function makeFakeReply() {
  const writes: string[] = [];
  const raw = {
    writeHead: vi.fn(),
    write: vi.fn((chunk: string) => { writes.push(chunk); }),
    end: vi.fn(),
  };
  return { raw, writes } as unknown as { raw: typeof raw; writes: string[] };
}

async function* fakeEvents(events: AgentStreamEvent[]): AsyncGenerator<AgentStreamEvent, void, void> {
  for (const e of events) yield e;
}

describe('pipeAgentStream', () => {
  it('writes real SSE headers before any event', async () => {
    const reply = makeFakeReply();
    await pipeAgentStream(reply as never, fakeEvents([{ type: 'done', data: {} }]));
    expect(reply.raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
    }));
  });

  it('writes one event/data frame per emitted event, in order, immediately (not batched)', async () => {
    const reply = makeFakeReply();
    await pipeAgentStream(reply as never, fakeEvents([
      { type: 'agent_started', data: { agent: 'nutrition' } },
      { type: 'token', data: { text: 'Hello' } },
      { type: 'done', data: {} },
    ]));

    const joined = reply.writes.join('');
    expect(joined).toContain('event: agent_started');
    expect(joined).toContain('event: token');
    expect(joined).toContain('event: done');
    expect(joined.indexOf('agent_started')).toBeLessThan(joined.indexOf('token'));
    expect(joined.indexOf('token')).toBeLessThan(joined.indexOf('done'));
  });

  it('surfaces a generator error as a real error event, then ends the stream', async () => {
    async function* throwingEvents(): AsyncGenerator<AgentStreamEvent, void, void> {
      yield { type: 'token', data: { text: 'partial' } };
      throw new Error('agent crashed');
    }
    const reply = makeFakeReply();
    await pipeAgentStream(reply as never, throwingEvents());

    const joined = reply.writes.join('');
    expect(joined).toContain('event: error');
    expect(joined).toContain('agent crashed');
    expect(reply.raw.end).toHaveBeenCalled();
  });

  it('always calls end(), even on the happy path', async () => {
    const reply = makeFakeReply();
    await pipeAgentStream(reply as never, fakeEvents([{ type: 'done', data: {} }]));
    expect(reply.raw.end).toHaveBeenCalledOnce();
  });
});
