import { vi } from 'vitest';
import type { ToolContext } from '../../types.js';
import type { AgentEvalCase } from '../types.js';

function makeLabResultsChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ['select', 'eq', 'gte']) chain[m] = vi.fn(self);
  chain.order = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  return chain;
}

function makeCtx(labResults: unknown[], biomarkerTypes: unknown[]): ToolContext {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'lab_results') return makeLabResultsChain(labResults);
      if (table === 'biomarker_types') return { select: () => Promise.resolve({ data: biomarkerTypes, error: null }) };
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return {
    supabase: supabase as never, gateway: null, userId: 'u1',
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
  };
}

const HBA1C_TYPE = [{ id: 'hba1c', display_name: 'HbA1c', unit: '%', normal_min: null, normal_max: 5.6 }];

export const BIOMARKER_EVAL_CASES: AgentEvalCase[] = [
  {
    id: 'biomarker-clarifying-question-no-guess',
    agent: 'biomarker',
    description: 'asks a clarifying question when no known biomarker is mentioned, never guesses one, calls zero tools',
    message: 'how am I doing health-wise',
    buildCtx: () => makeCtx([], []),
    expect: { responseIncludes: ['which biomarker'] },
  },
  {
    id: 'biomarker-out-of-range-real-trend-and-disclaimer',
    agent: 'biomarker',
    description: 'reports a real OLS trend + reference-range flag for an out-of-range HbA1c and the Output Guard appends the medical disclaimer',
    message: 'how is my hba1c trending',
    buildCtx: () => makeCtx([
      { value: 6.2, unit: '%', measured_at: '2026-01-01T00:00:00Z' },
      { value: 6.5, unit: '%', measured_at: '2026-02-01T00:00:00Z' },
      { value: 6.8, unit: '%', measured_at: '2026-03-01T00:00:00Z' },
      { value: 7.1, unit: '%', measured_at: '2026-04-01T00:00:00Z' },
    ], HBA1C_TYPE),
    expect: { toolsCalled: ['biomarker.trends'], responseIncludes: ['7.1', 'not medical advice'] },
  },
  {
    id: 'biomarker-in-range-no-disclaimer',
    agent: 'biomarker',
    description: 'does not append the medical disclaimer when every reading is within the normal range',
    message: 'my hba1c result',
    buildCtx: () => makeCtx([{ value: 5.0, unit: '%', measured_at: '2026-01-01T00:00:00Z' }], HBA1C_TYPE),
    expect: { responseExcludes: ['not medical advice'] },
  },
  {
    id: 'biomarker-no-history-honest',
    agent: 'biomarker',
    description: 'reports honestly when there is no recorded history for the requested biomarker, never fabricates a reading',
    message: 'my hba1c',
    buildCtx: () => makeCtx([], HBA1C_TYPE),
    expect: { responseIncludes: ["don't have any recorded"] },
  },
];
