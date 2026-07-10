// memory.facts — Phase 13 (§16.3). Read-only, per-agent section access. Wraps
// memory/facts-service.ts's getFacts() then filters by factType — agents declare which sections
// they're allowed to see in agents/agent-specs.ts (§16.1.6: "agents receive only the sections
// relevant to them ... never the raw event store"); this tool never exposes user_events, only
// already-derived, already-decayed facts.

import type { ToolDefinition, ToolContext } from '../types.js';
import { getFacts, type StoredMemoryFact } from '../../memory/facts-service.js';
import type { MemoryFactType } from '../../memory/aggregation/types.js';

export interface MemoryFactsInput {
  sections: MemoryFactType[];
}

export const memoryFactsTool: ToolDefinition<MemoryFactsInput, StoredMemoryFact[]> = {
  name: 'memory.facts',
  description: 'Read-only, already-derived memory facts filtered to the requesting agent\'s declared sections. Never the raw episodic event store.',
  execute: async (input, ctx) => {
    const facts = await getFacts(ctx.supabase, ctx.userId, { activeOnly: true });
    const allowed = new Set(input.sections);
    return facts.filter((f) => allowed.has(f.factType));
  },
};
