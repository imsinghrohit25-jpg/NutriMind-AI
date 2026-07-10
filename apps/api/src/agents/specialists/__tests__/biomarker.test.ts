import { describe, it, expect, vi } from 'vitest';
import { runBiomarkerAgent } from '../biomarker.js';
import { ToolRegistry } from '../../tool-registry.js';
import type { ToolContext } from '../../types.js';

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

describe('runBiomarkerAgent', () => {
  it('asks a clarifying question when no known biomarker is mentioned — never guesses', async () => {
    const ctx = makeCtx([], []);
    const registry = new ToolRegistry();
    const result = await runBiomarkerAgent({ message: 'how am I doing health-wise', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.responseText).toMatch(/which biomarker/i);
    expect(result.toolTrace).toHaveLength(0);
  });

  it('reports real trend + reference-range flag for an out-of-range HbA1c, and requires the medical disclaimer', async () => {
    const rows = [
      { value: 6.2, unit: '%', measured_at: '2026-01-01T00:00:00Z' },
      { value: 6.5, unit: '%', measured_at: '2026-02-01T00:00:00Z' },
      { value: 6.8, unit: '%', measured_at: '2026-03-01T00:00:00Z' },
      { value: 7.1, unit: '%', measured_at: '2026-04-01T00:00:00Z' },
    ];
    const ctx = makeCtx(rows, HBA1C_TYPE);
    const registry = new ToolRegistry();

    const result = await runBiomarkerAgent({ message: 'how is my hba1c trending', ctx, registry, locale: 'en-IN', handoffState: {} });

    expect(result.toolTrace.some((t) => t.tool === 'biomarker.trends')).toBe(true);
    expect(result.requiresMedicalDisclaimer).toBe(true);
    expect(result.responseText).toMatch(/7\.1/);
    expect(result.responseText).toMatch(/high/i);
  });

  it('does not require a disclaimer when every reading is within the normal range', async () => {
    const rows = [{ value: 5.0, unit: '%', measured_at: '2026-01-01T00:00:00Z' }];
    const ctx = makeCtx(rows, HBA1C_TYPE);
    const registry = new ToolRegistry();

    const result = await runBiomarkerAgent({ message: 'my hba1c result', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.requiresMedicalDisclaimer).toBe(false);
  });

  it('reports honestly when there is no recorded history for the requested biomarker', async () => {
    const ctx = makeCtx([], HBA1C_TYPE);
    const registry = new ToolRegistry();
    const result = await runBiomarkerAgent({ message: 'my hba1c', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.responseText).toMatch(/don't have any recorded/i);
  });
});
