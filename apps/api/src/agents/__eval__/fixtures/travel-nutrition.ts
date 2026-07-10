import { vi } from 'vitest';
import type { ToolContext } from '../../types.js';
import type { AgentEvalCase } from '../types.js';

function makeCtx(): ToolContext {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'users_profiles') return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      if (table === 'user_events') return { insert: () => Promise.resolve({ error: null }) };
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return {
    supabase: supabase as never, gateway: null, userId: 'u1',
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
  };
}

export const TRAVEL_NUTRITION_EVAL_CASES: AgentEvalCase[] = [
  {
    id: 'travel-no-destination-asks-not-guesses',
    agent: 'travel_nutrition',
    description: 'asks which country when none is detected, never guesses a destination, calls zero tools',
    message: 'I am traveling next week',
    buildCtx: makeCtx,
    expect: { responseIncludes: ['which country'] },
  },
  {
    id: 'travel-multi-agent-handoff-scenario-dubai',
    agent: 'travel_nutrition',
    description: 'the exact acceptance-gate scenario: detects a city gazetteer entry and confirms a real, non-silent country transition',
    message: 'main agle hafte Dubai ja raha hoon, meal plan adjust karo',
    buildCtx: makeCtx,
    expect: { toolsCalled: ['country.transition'], responseIncludes: ['switched your context'], handoffStateIncludes: { newCountryIsoCode: 'AE' } },
  },
  {
    id: 'travel-country-name-not-just-city-gazetteer',
    agent: 'travel_nutrition',
    description: 'detects a bare country name (Germany has no city gazetteer entry, only Berlin/Munich do)',
    message: 'planning a trip to Germany',
    buildCtx: makeCtx,
    expect: { toolsCalled: ['country.transition'], handoffStateIncludes: { newCountryIsoCode: 'DE' } },
  },
  {
    id: 'travel-home-goals-stay-active',
    agent: 'travel_nutrition',
    description: 'explicitly reassures the user their home-country goals remain active — this agent never touches user.goals',
    message: 'going to London for a conference',
    buildCtx: makeCtx,
    expect: { responseIncludes: ['home-country goals stay active'] },
  },
];
