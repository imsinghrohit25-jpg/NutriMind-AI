// Shared Tool Registry — Phase 13 (§16.3). The ONLY way any agent touches data or engines.
// Enforces §16.1.3's allowlist contract: calling a tool outside an agent's declared allowlist
// throws ToolNotAllowedError — a runtime error, not a warning, checked on every single call, not
// just at graph-construction time (so a compromised/adversarial prompt that convinces an LLM to
// "call" an unlisted tool still can't actually reach it).

import type { ToolContext, ToolDefinition, ToolName, AgentName } from './types.js';
import { ToolNotAllowedError, ToolNotFoundError } from './types.js';
import { ALL_TOOLS } from './tools/index.js';
import { withToolSpan } from './observability.js';

export class ToolRegistry {
  private readonly tools = new Map<ToolName, ToolDefinition<unknown, unknown>>();

  // Intentionally `any` here: this registry is a heterogeneous collection of tools with mutually
  // incompatible input/output types by design (that's the whole point of a registry) — each
  // `call<TInput,TOutput>()`/`callAsAgent<TInput,TOutput>()` call site is where real type safety
  // is recovered, via its own generic parameters matching the specific tool being invoked.
  constructor(definitions: ToolDefinition<any, any>[] = ALL_TOOLS) {
    for (const def of definitions) {
      this.tools.set(def.name, def);
    }
  }

  has(name: ToolName): boolean {
    return this.tools.has(name);
  }

  list(): ToolName[] {
    return [...this.tools.keys()];
  }

  /** Direct call, no allowlist check — used by the Output Guard, which is allowed to invoke any
   *  tool (e.g. allergen.check) as a final re-verification regardless of which agent produced
   *  the response it's checking. Agents themselves must always go through `callAsAgent`. */
  async call<TInput, TOutput>(name: ToolName, input: TInput, ctx: ToolContext): Promise<TOutput> {
    const def = this.tools.get(name);
    if (!def) throw new ToolNotFoundError(name);
    return def.execute(input, ctx) as Promise<TOutput>;
  }

  /** The only entry point agent nodes may use. `allowlist` is the CALLING agent's own declared
   *  tool list (agents/agent-specs.ts) — passed explicitly rather than looked up internally so
   *  there is exactly one place (agent-specs.ts) that defines what an agent may do, and this
   *  function can't silently fall back to "allow everything" if a lookup ever returned undefined. */
  async callAsAgent<TInput, TOutput>(
    agentName: AgentName,
    toolName: ToolName,
    input: TInput,
    ctx: ToolContext,
    allowlist: readonly ToolName[],
  ): Promise<TOutput> {
    if (!allowlist.includes(toolName)) {
      throw new ToolNotAllowedError(agentName, toolName, allowlist);
    }
    return withToolSpan(toolName, agentName, () => this.call<TInput, TOutput>(toolName, input, ctx));
  }
}
