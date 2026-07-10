// Supervisor — Phase 13 (§16.2). LangGraph.js StateGraph: classify -> dispatch (loops through
// the sequential multi-agent plan, one agent per iteration, real structured-state handoff between
// them) -> Output Guard -> END. Every path through this graph terminates through the Output
// Guard node — there is no edge that reaches END without it (§16.1.4).

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import type { AgentName, ToolContext } from './types.js';
import type { ToolRegistry } from './tool-registry.js';
import type { SpecialistAgentRunner } from './agent-runner.js';
import type { ToolTraceEntry, AllergenRecheckInput, OutputGuardResult } from './output-guard.js';
import { runOutputGuard } from './output-guard.js';
import { classifyIntent } from './intent-classifier.js';
import type { AgentStreamEvent } from './sse.js';
import { withAgentSpan, withGuardSpan } from './observability.js';

const SupervisorState = Annotation.Root({
  message: Annotation<string>(),
  locale: Annotation<string>(),
  ctx: Annotation<ToolContext>(),
  registry: Annotation<ToolRegistry>(),
  plan: Annotation<AgentName[]>({ default: () => [], reducer: (_a, b) => b }),
  currentStep: Annotation<number>({ default: () => 0, reducer: (_a, b) => b }),
  handoffState: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (a, b) => ({ ...a, ...b }),
  }),
  toolTrace: Annotation<ToolTraceEntry[]>({ default: () => [], reducer: (a, b) => a.concat(b) }),
  agentResponses: Annotation<string[]>({ default: () => [], reducer: (a, b) => a.concat(b) }),
  requiresMedicalDisclaimer: Annotation<boolean>({ default: () => false, reducer: (a, b) => a || b }),
  allergenRecheckInput: Annotation<AllergenRecheckInput | undefined>({
    default: () => undefined,
    reducer: (a, b) => b ?? a,
  }),
  guardResult: Annotation<OutputGuardResult | null>({ default: () => null, reducer: (_a, b) => b }),
});

export type SupervisorStateType = typeof SupervisorState.State;

export interface SupervisorRunResult {
  plan: AgentName[];
  guardResult: OutputGuardResult;
}

/** Built with the real agent registry once all 9 specialists exist (agents/index.ts); accepting
 *  it as a parameter (rather than importing the 9 agent modules directly in this file) is what
 *  makes the graph's own control flow — classify, sequential dispatch, terminate through the
 *  guard — testable with fake agents before every specialist is built. */
export function buildSupervisorGraph(agentRegistry: Partial<Record<AgentName, SpecialistAgentRunner>>) {
  const graph = new StateGraph(SupervisorState)
    .addNode('classify', async (state) => {
      const classification = await classifyIntent(state.message, state.ctx.gateway);
      return { plan: classification.agents };
    })
    .addNode('dispatch', async (state) => {
      const agentName = state.plan[state.currentStep];
      if (!agentName) return {};

      const runner = agentRegistry[agentName];
      if (!runner) {
        // A classified agent with no registered runner yet — real, honest state (not every
        // agent may be wired in a given deployment/test), never silently skipped without a
        // trace: it becomes part of the response so the gap is visible, not swallowed.
        return {
          currentStep: state.currentStep + 1,
          agentResponses: [`[${agentName} agent not available]`],
        };
      }

      const result = await withAgentSpan(
        agentName,
        { 'nutrimind.agent.step': state.currentStep },
        async (span) => {
          const r = await runner({
            message: state.message,
            ctx: state.ctx,
            registry: state.registry,
            locale: state.locale,
            handoffState: state.handoffState,
          });
          span.setAttribute('nutrimind.agent.tool_call_count', r.toolTrace.length);
          return r;
        },
      );

      return {
        currentStep: state.currentStep + 1,
        toolTrace: result.toolTrace,
        agentResponses: [result.responseText],
        handoffState: result.handoffState ?? {},
        requiresMedicalDisclaimer: result.requiresMedicalDisclaimer ?? false,
        allergenRecheckInput: result.allergenRecheckInput,
      };
    })
    .addNode('guard', (state) => {
      const guardResult = withGuardSpan(
        () => runOutputGuard({
          responseText: state.agentResponses.join('\n\n'),
          toolTrace: state.toolTrace,
          allergenRecheck: state.allergenRecheckInput,
          requiresMedicalDisclaimer: state.requiresMedicalDisclaimer,
          locale: state.locale,
        }),
        (result) => ({
          'nutrimind.guard.allowed': result.allowed,
          'nutrimind.guard.rejection_reason': result.rejectionReason ?? '',
        }),
      );
      return { guardResult };
    })
    .addEdge(START, 'classify')
    .addEdge('classify', 'dispatch')
    .addConditionalEdges('dispatch', (state) => (state.currentStep < state.plan.length ? 'dispatch' : 'guard'))
    .addEdge('guard', END);

  return graph.compile();
}

export async function runSupervisor(
  agentRegistry: Partial<Record<AgentName, SpecialistAgentRunner>>,
  input: { message: string; ctx: ToolContext; registry: ToolRegistry; locale?: string },
): Promise<SupervisorRunResult> {
  const app = buildSupervisorGraph(agentRegistry);
  const finalState = await app.invoke({
    message: input.message,
    ctx: input.ctx,
    registry: input.registry,
    locale: input.locale ?? 'en-IN',
  });

  return { plan: finalState.plan, guardResult: finalState.guardResult! };
}

/** Streaming variant of runSupervisor — used by routes/v1/agent.ts's SSE endpoint. Uses
 *  LangGraph.js's own `.stream()` (default `streamMode: "updates"`), which yields the REAL delta
 *  produced by each node as it actually finishes — this is genuine incremental delivery of the
 *  graph's real progress (classification result, then each dispatch step's real tool trace and
 *  handoff state, then the guard verdict), never fabricated/artificial chunking of a string that
 *  was already fully computed.
 *
 *  Deliberately does NOT stream the final answer text token-by-token: §16.1.4's Output Guard must
 *  validate every numeric claim and re-check allergens BEFORE any of the response reaches the
 *  client, because a token stream that started before the guard ran could leak a fabricated
 *  number or an unsafe allergen claim to the user in the half-second before a rejection is
 *  detected. So `finalText` is delivered whole, in the `done` event, only after `guardResult`
 *  confirms `allowed: true` — the lifecycle events leading up to it are what make this real
 *  streaming rather than one buffered response. */
export async function* runSupervisorStream(
  agentRegistry: Partial<Record<AgentName, SpecialistAgentRunner>>,
  input: { message: string; ctx: ToolContext; registry: ToolRegistry; locale?: string },
): AsyncGenerator<AgentStreamEvent, void, void> {
  const app = buildSupervisorGraph(agentRegistry);
  const locale = input.locale ?? 'en-IN';
  const stream = await app.stream({
    message: input.message,
    ctx: input.ctx,
    registry: input.registry,
    locale,
  });

  let plan: AgentName[] = [];
  let stepIndex = 0;

  for await (const chunk of stream as AsyncIterable<Record<string, Partial<SupervisorStateType>>>) {
    if (chunk.classify) {
      plan = chunk.classify.plan ?? [];
      yield { type: 'agent_started', data: { plan } };
      continue;
    }

    if (chunk.dispatch) {
      const delta = chunk.dispatch;
      const agentName = plan[stepIndex];
      stepIndex = delta.currentStep ?? stepIndex + 1;

      for (const entry of delta.toolTrace ?? []) {
        yield { type: 'tool_call', data: { agent: agentName, tool: entry.tool } };
        yield { type: 'tool_result', data: { agent: agentName, tool: entry.tool, output: entry.output } };
      }

      yield {
        type: 'agent_handoff',
        data: { agent: agentName, handoffState: delta.handoffState ?? {}, stepIndex, planLength: plan.length },
      };
      continue;
    }

    if (chunk.guard) {
      const guardResult = chunk.guard.guardResult!;
      if (!guardResult.allowed) {
        yield { type: 'guard_rejected', data: { reason: guardResult.rejectionReason } };
      } else {
        yield { type: 'done', data: { finalText: guardResult.finalText, plan } };
      }
    }
  }
}
