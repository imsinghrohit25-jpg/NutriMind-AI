import { vi } from 'vitest';
import type { ToolContext } from '../../types.js';
import type { AgentEvalCase } from '../types.js';

function makeCtx(gateway: unknown = null): ToolContext {
  return {
    gateway: gateway as never, supabase: { from: vi.fn() } as never, userId: 'u1',
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
  };
}

function makeReceiptCtx(): ToolContext {
  const ctx = makeCtx();
  (ctx.supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'pantry_receipts') return { insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'r1' }, error: null }) }) }) };
    if (table === 'pantry_items') return { insert: () => Promise.resolve({ error: null }) };
    throw new Error(`unexpected table ${table}`);
  });
  return ctx;
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

export const OCR_EVAL_CASES: AgentEvalCase[] = [
  {
    id: 'ocr-classifies-and-parses-real-label',
    agent: 'ocr',
    description: 'classifies and parses a real nutrition label, surfacing low-confidence fields for confirmation rather than silently trusting them',
    message: LABEL_TEXT,
    buildCtx: makeCtx,
    expect: { toolsCalled: ['ocr.process'], responseIncludes: ['label'], handoffStateIncludes: { lastOcrDocType: 'label' } },
  },
  {
    id: 'ocr-flags-receipt-price-mismatch',
    agent: 'ocr',
    description: 'flags a reconciliation warning when real item prices don\'t sum to the stated real total, rather than hiding the discrepancy',
    message: RECEIPT_TEXT,
    buildCtx: makeReceiptCtx,
    expect: { toolsCalled: ['ocr.process'], handoffStateIncludes: { lastOcrDocType: 'receipt' } },
  },
  {
    id: 'ocr-lab-report-requires-real-record-never-invents-one',
    agent: 'ocr',
    description: 'requires a real lab report record to attach results to before attempting to persist — never invents one, calls zero tools',
    message: 'HbA1c 6.5% Reference range 4-5.6%',
    buildCtx: makeCtx,
    expect: { responseIncludes: ['lab report record'] },
  },
  {
    id: 'ocr-menu-scan-needs-gateway-honest',
    agent: 'ocr',
    description: 'reports honestly when a menu scan is requested with no AI gateway configured',
    message: 'starter menu prices',
    handoffState: { docType: 'menu' },
    buildCtx: () => makeCtx(null),
    expect: { responseIncludes: ["isn't configured"] },
  },
];
