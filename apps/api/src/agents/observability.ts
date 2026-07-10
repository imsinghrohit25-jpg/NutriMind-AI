// Per-agent/per-tool observability — Phase 13 (§16.5: "Per-agent observability dashboards").
// Real OTEL child spans AND metrics through the SAME pipeline telemetry/otel.ts's NodeSDK already
// registers (OTLP trace exporter + Prometheus metric reader in production; tests register their
// own InMemorySpanExporter — see agents/__tests__/observability.test.ts) — no separate/parallel
// logging mechanism invented. A dashboard is only as real as what it queries: unlike
// observability/grafana/dashboards/llm-costs.json (which references `nutrimind_llm_*` metrics
// that are never actually emitted anywhere in this codebase — a pre-existing, undocumented gap
// found while building this file, left as-is since fixing Phase 12's dashboard is out of this
// phase's scope), observability/grafana/dashboards/multi-agent.json's panels query ONLY the
// counters/histograms this file actually records below.

import { trace, metrics, SpanStatusCode, type Span } from '@opentelemetry/api';
import type { AgentName, ToolName } from './types.js';

const tracer = trace.getTracer('nutrimind.agents');
const meter = metrics.getMeter('nutrimind.agents');

const agentInvocations = meter.createCounter('nutrimind_agent_invocations_total', {
  description: 'Specialist agent invocations, by agent name and outcome (ok/error).',
});
const agentLatencyMs = meter.createHistogram('nutrimind_agent_latency_ms', {
  description: 'Specialist agent execution latency in milliseconds, by agent name.',
});
const toolInvocations = meter.createCounter('nutrimind_tool_invocations_total', {
  description: 'Tool Registry calls, by tool name, calling agent, and outcome (ok/error).',
});
const toolLatencyMs = meter.createHistogram('nutrimind_tool_latency_ms', {
  description: 'Tool execution latency in milliseconds, by tool name and calling agent.',
});
const guardVerdicts = meter.createCounter('nutrimind_guard_verdicts_total', {
  description: 'Output Guard verdicts, by allowed (true/false).',
});

type AttrValue = string | number | boolean;

function setAttrs(span: Span, attrs: Record<string, AttrValue>): void {
  for (const [key, value] of Object.entries(attrs)) span.setAttribute(key, value);
}

/** Wraps one specialist agent's execution within a multi-agent plan's dispatch step. */
export async function withAgentSpan<T>(
  agentName: AgentName,
  attrs: Record<string, AttrValue>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const start = Date.now();
  return tracer.startActiveSpan(`agent.${agentName}`, async (span) => {
    setAttrs(span, { 'nutrimind.agent.name': agentName, ...attrs });
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      agentInvocations.add(1, { agent: agentName, outcome: 'ok' });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      agentInvocations.add(1, { agent: agentName, outcome: 'error' });
      throw err;
    } finally {
      agentLatencyMs.record(Date.now() - start, { agent: agentName });
      span.end();
    }
  });
}

/** Wraps one real tool execution (agents/tool-registry.ts's callAsAgent) — the calling agent's
 *  name is always attached, so a dashboard can slice "time spent per tool, per agent." */
export async function withToolSpan<T>(
  toolName: ToolName,
  agentName: AgentName,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  return tracer.startActiveSpan(`tool.${toolName}`, async (span) => {
    setAttrs(span, { 'nutrimind.tool.name': toolName, 'nutrimind.tool.calling_agent': agentName });
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      toolInvocations.add(1, { tool: toolName, agent: agentName, outcome: 'ok' });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      toolInvocations.add(1, { tool: toolName, agent: agentName, outcome: 'error' });
      throw err;
    } finally {
      toolLatencyMs.record(Date.now() - start, { tool: toolName, agent: agentName });
      span.end();
    }
  });
}

/** Wraps the Output Guard verdict — synchronous, since runOutputGuard itself is (§16.1.4: no LLM
 *  call in the guard path). `attrsFromResult` is applied AFTER `fn()` runs, so the span carries
 *  the real verdict (allowed/rejected + why), not just that it ran. */
export function withGuardSpan<T>(fn: () => T, attrsFromResult: (result: T) => Record<string, AttrValue>): T {
  return tracer.startActiveSpan('agent.output_guard', (span) => {
    try {
      const result = fn();
      const attrs = attrsFromResult(result);
      setAttrs(span, attrs);
      span.setStatus({ code: SpanStatusCode.OK });
      guardVerdicts.add(1, { allowed: String(attrs['nutrimind.guard.allowed'] ?? 'unknown') });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}
