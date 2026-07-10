import { describe, it, expect, vi } from 'vitest';
import { runOcrAgent } from '../ocr.js';
import { ToolRegistry } from '../../tool-registry.js';
import type { ToolContext } from '../../types.js';

function makeCtx(gateway: unknown = null): ToolContext {
  return {
    gateway: gateway as never, supabase: { from: vi.fn() } as never, userId: 'u1',
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
  };
}

const LABEL_TEXT = `
Nutrition Facts
Per 100g
Energy 450 kcal
Protein 6g
Total Fat 14g
Sodium 300mg
Ingredients: Wheat Flour, Sugar, Palm Oil
`;

const RECEIPT_TEXT = `
BIG BAZAAR
Tomato 2 kg 40
Onion 1 kg 30
Total 200
`;

describe('runOcrAgent', () => {
  it('classifies and parses a real nutrition label, surfacing low-confidence fields for confirmation', async () => {
    const ctx = makeCtx();
    const registry = new ToolRegistry();
    const result = await runOcrAgent({ message: LABEL_TEXT, ctx, registry, locale: 'en-IN', handoffState: {} });

    expect(result.toolTrace[0]!.tool).toBe('ocr.process');
    expect(result.responseText).toMatch(/label/i);
    expect(result.handoffState!.lastOcrDocType).toBe('label');
  });

  it('classifies and parses a real receipt, flagging a reconciliation warning when item prices don\'t sum to the stated total', async () => {
    const ctx = makeCtx();
    const registry = new ToolRegistry();
    // meal_logs / pantry inserts are needed since persist:true
    (ctx.supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'pantry_receipts') return { insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'r1' }, error: null }) }) }) };
      if (table === 'pantry_items') return { insert: () => Promise.resolve({ error: null }) };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await runOcrAgent({ message: RECEIPT_TEXT, ctx, registry, locale: 'en-IN', handoffState: {} });

    expect(result.handoffState!.lastOcrDocType).toBe('receipt');
    // Tomato (40) + Onion (30) = 70, stated total 200 -> mismatch by far more than 10%
    expect(result.responseText).toMatch(/prices sum to|misread/i);
  });

  it('requires a labReportId before attempting to persist lab results — never invents one', async () => {
    const ctx = makeCtx();
    const registry = new ToolRegistry();
    const result = await runOcrAgent({
      message: 'HbA1c 6.5% Reference range 4-5.6%', ctx, registry, locale: 'en-IN', handoffState: {},
    });
    expect(result.responseText).toMatch(/lab report record/i);
    expect(result.toolTrace).toHaveLength(0);
  });

  it('reports honestly when a menu scan is requested with no AI gateway configured', async () => {
    const ctx = makeCtx(null);
    const registry = new ToolRegistry();
    const result = await runOcrAgent({
      message: 'starter menu prices', ctx, registry, locale: 'en-IN', handoffState: { docType: 'menu' },
    });
    expect(result.responseText).toMatch(/isn't configured/i);
  });
});
