// Specialist agent contract — Phase 13 (§16.1.3: "typed input schema, typed output schema...").
// Every one of the 9 agents (agents/specialists/*.ts) implements this same shape, which is what
// lets the Supervisor (agents/supervisor.ts) treat them uniformly for handoff/state-threading
// while each agent's OWN internal tool pipeline is completely different.

import type { ToolContext, AgentName, ToolName } from './types.js';
import type { ToolRegistry } from './tool-registry.js';
import type { ToolTraceEntry, AllergenRecheckInput } from './output-guard.js';
import { AGENT_TOOL_ALLOWLISTS } from './agent-specs.js';

export interface SpecialistAgentInput {
  message: string;
  ctx: ToolContext;
  registry: ToolRegistry;
  locale: string;
  /** Structured state handed off from earlier agents in a multi-agent plan (§16.2: "passing
   *  structured state, never free-text between agents") — e.g. Travel Nutrition Agent hands the
   *  Meal Planning Agent the new CountryProfile, never a free-text summary of it. */
  handoffState: Record<string, unknown>;
}

export interface SpecialistAgentResult {
  responseText: string;
  toolTrace: ToolTraceEntry[];
  /** Merged into handoffState for the NEXT agent in the plan, if any. */
  handoffState?: Record<string, unknown>;
  requiresMedicalDisclaimer?: boolean;
  allergenRecheckInput?: AllergenRecheckInput;
}

export type SpecialistAgentRunner = (input: SpecialistAgentInput) => Promise<SpecialistAgentResult>;

/** One agent's bound, allowlist-enforced tool caller + a running trace it appends to — every
 *  specialist agent module builds one of these first thing, so its tool calls are automatically
 *  both allowlist-checked (tool-registry.ts's callAsAgent) and captured into the toolTrace the
 *  Output Guard's numeric-claim validator needs. */
export function makeAgentToolCaller(agentName: AgentName, registry: ToolRegistry, ctx: ToolContext) {
  const trace: ToolTraceEntry[] = [];
  return {
    trace,
    async call<TInput, TOutput>(tool: ToolName, input: TInput): Promise<TOutput> {
      const output = await registry.callAsAgent<TInput, TOutput>(
        agentName, tool, input, ctx, AGENT_TOOL_ALLOWLISTS[agentName],
      );
      trace.push({ tool, output });
      return output;
    },
  };
}
