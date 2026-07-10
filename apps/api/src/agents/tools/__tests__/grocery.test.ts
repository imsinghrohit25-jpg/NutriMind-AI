import { describe, it, expect, vi } from 'vitest';
import { groceryPriceHistoryTool } from '../grocery.js';

function makeSupabase(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          ilike: () => ({
            not: () => ({
              gte: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
            }),
          }),
        }),
      }),
    })),
  };
}

describe('groceryPriceHistoryTool', () => {
  it('returns an empty result with a null average — never a guessed price — when there is no receipt history', async () => {
    const result = await groceryPriceHistoryTool.execute(
      { ingredientName: 'saffron' }, { supabase: makeSupabase([]), userId: 'u1' } as never,
    );
    expect(result.entries).toHaveLength(0);
    expect(result.averagePriceRs).toBeNull();
  });

  it('computes a real average from real receipt-parsed prices', async () => {
    const rows = [
      { estimated_rs: 40, purchase_date: '2026-06-01', source: 'receipt_ocr' },
      { estimated_rs: 60, purchase_date: '2026-06-15', source: 'receipt_ocr' },
    ];
    const result = await groceryPriceHistoryTool.execute(
      { ingredientName: 'tomato' }, { supabase: makeSupabase(rows), userId: 'u1' } as never,
    );
    expect(result.entries).toHaveLength(2);
    expect(result.averagePriceRs).toBe(50);
  });
});
