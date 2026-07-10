// Proves the Phase 13 (§16.5) per-agent/per-tool instrumentation emits REAL OTEL spans through
// the real @opentelemetry/api tracer registry — registers an in-memory exporter (the standard
// OTEL testing pattern) rather than asserting "it didn't throw," since a no-op tracer would also
// "not throw" while emitting nothing.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { trace } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { withAgentSpan, withToolSpan, withGuardSpan } from '../observability.js';
import { ToolRegistry } from '../tool-registry.js';
import { AGENT_TOOL_ALLOWLISTS } from '../agent-specs.js';
import { ToolNotAllowedError } from '../types.js';
import type { ToolContext } from '../types.js';

let exporter: InMemorySpanExporter;
let provider: BasicTracerProvider;

beforeAll(() => {
  exporter = new InMemorySpanExporter();
  provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);
});

afterAll(async () => {
  await provider.shutdown();
});

beforeEach(() => {
  exporter.reset();
});

describe('withAgentSpan', () => {
  it('emits a real span named agent.<name> with the given attributes and OK status', async () => {
    const result = await withAgentSpan('nutrition', { 'nutrimind.agent.step': 0 }, async (span) => {
      span.setAttribute('nutrimind.agent.tool_call_count', 2);
      return 'ok';
    });

    expect(result).toBe('ok');
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.name).toBe('agent.nutrition');
    expect(spans[0]!.attributes['nutrimind.agent.name']).toBe('nutrition');
    expect(spans[0]!.attributes['nutrimind.agent.step']).toBe(0);
    expect(spans[0]!.attributes['nutrimind.agent.tool_call_count']).toBe(2);
    expect(spans[0]!.status.code).toBe(1); // SpanStatusCode.OK
  });

  it('records the exception and marks the span as an error when the agent throws', async () => {
    await expect(
      withAgentSpan('grocery', {}, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.status.code).toBe(2); // SpanStatusCode.ERROR
    expect(spans[0]!.events.some((e) => e.name === 'exception')).toBe(true);
  });
});

describe('withToolSpan', () => {
  it('emits a real span named tool.<name> carrying the calling agent', async () => {
    const result = await withToolSpan('nutrition.compute', 'nutrition', async () => 42);

    expect(result).toBe(42);
    const spans = exporter.getFinishedSpans();
    expect(spans[0]!.name).toBe('tool.nutrition.compute');
    expect(spans[0]!.attributes['nutrimind.tool.name']).toBe('nutrition.compute');
    expect(spans[0]!.attributes['nutrimind.tool.calling_agent']).toBe('nutrition');
  });

  it('is really invoked end-to-end through ToolRegistry.callAsAgent, not just in isolation', async () => {
    const registry = new ToolRegistry([
      { name: 'nutrition.compute', description: 'x', execute: async () => ({ per100g: null, score: null, dataQualityGrade: 'A' }) },
    ] as never);
    const ctx = {} as ToolContext;

    await registry.callAsAgent('nutrition', 'nutrition.compute', {}, ctx, AGENT_TOOL_ALLOWLISTS.nutrition);

    const spans = exporter.getFinishedSpans();
    expect(spans.some((s) => s.name === 'tool.nutrition.compute')).toBe(true);
  });

  it('does not emit a span at all for a tool-allowlist violation — the throw happens before any tool runs', async () => {
    const registry = new ToolRegistry();
    const ctx = {} as ToolContext;

    await expect(
      registry.callAsAgent('voice', 'nutrition.compute', {}, ctx, AGENT_TOOL_ALLOWLISTS.voice),
    ).rejects.toThrow(ToolNotAllowedError);

    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });
});

describe('withGuardSpan', () => {
  it('emits agent.output_guard with attributes derived from the real result, after it runs', () => {
    const result = withGuardSpan(
      () => ({ allowed: false, rejectionReason: 'numeric mismatch' }),
      (r) => ({ 'nutrimind.guard.allowed': r.allowed, 'nutrimind.guard.rejection_reason': r.rejectionReason }),
    );

    expect(result.allowed).toBe(false);
    const spans = exporter.getFinishedSpans();
    expect(spans[0]!.name).toBe('agent.output_guard');
    expect(spans[0]!.attributes['nutrimind.guard.allowed']).toBe(false);
    expect(spans[0]!.attributes['nutrimind.guard.rejection_reason']).toBe('numeric mismatch');
  });
});
