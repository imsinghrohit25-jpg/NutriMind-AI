// Receipt OCR parser.
// Uses LLM (parse_assist tier) to extract grocery items from receipt text.
// Handles Indian date formats: DD/MM/YY, DD-MM-YYYY, DD MMM YYYY, etc.
// Falls back to regex-only path if LLM is unavailable.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';

export interface ParsedReceiptItem {
  name:          string;
  quantity:      number;
  unit:          string;
  priceRs?:      number;
  expiryDate?:   string;  // ISO YYYY-MM-DD — may not be on receipt; estimated if staple
  category?:     string;
}

export interface ParsedReceipt {
  storeName?:  string;
  billDate?:   string;  // ISO YYYY-MM-DD
  totalRs?:    number;
  items:       ParsedReceiptItem[];
}

// ── Indian date format normaliser ────────────────────────────────────────────
// Handles: 07/07/26, 07-07-2026, 07 Jul 2026, 7 July 2026
const MONTH_NAMES: Record<string, string> = {
  jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
  jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
};

export function parseIndianDate(raw: string): string | undefined {
  raw = raw.trim();

  // DD/MM/YY or DD/MM/YYYY
  const slashMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(raw);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    const year = y!.length === 2 ? `20${y}` : y;
    return `${year}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }

  // DD MMM YYYY or D Month YYYY
  const textMatch = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(raw);
  if (textMatch) {
    const [, d, mon, y] = textMatch;
    const m = MONTH_NAMES[mon!.toLowerCase().slice(0, 3)];
    if (m) return `${y}-${m}-${d!.padStart(2, '0')}`;
  }

  return undefined;
}

// ── Default shelf life estimates (days) ─────────────────────────────────────
const SHELF_LIFE_DAYS: Record<string, number> = {
  milk: 3, curd: 5, paneer: 4, bread: 5, vegetables: 5, fruit: 7,
  rice: 365, dal: 365, atta: 90, maida: 90, oil: 180, ghee: 180,
  eggs: 21, chicken: 2, fish: 1, meat: 2,
  biscuit: 90, chips: 30, instant: 60, noodles: 180,
};

function estimateExpiry(itemName: string, purchaseDate: string): string | undefined {
  const lower = itemName.toLowerCase();
  for (const [key, days] of Object.entries(SHELF_LIFE_DAYS)) {
    if (lower.includes(key)) {
      const dt = new Date(purchaseDate);
      dt.setDate(dt.getDate() + days);
      return dt.toISOString().slice(0, 10);
    }
  }
  return undefined;
}

// ── Regex fallback for simple receipt formats ────────────────────────────────
const LINE_RE = /^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|ml|l|nos?|pcs?|packets?|pkts?)?\s+(\d+(?:\.\d+)?)$/i;

function regexParseReceipt(text: string): ParsedReceipt {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: ParsedReceiptItem[] = [];
  let storeName: string | undefined;
  let billDate:  string | undefined;
  let totalRs:   number | undefined;

  for (const line of lines) {
    // Store name is usually the first non-blank line (all caps)
    if (!storeName && /^[A-Z\s&'.]{5,}$/.test(line)) { storeName = line; continue; }

    // Date patterns
    if (!billDate) {
      const dateRaw = /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/.exec(line)?.[1];
      if (dateRaw) { billDate = parseIndianDate(dateRaw); }
    }

    // Total line
    if (/\b(total|grand total|bill amount)\b/i.test(line)) {
      const m = /(\d+(?:\.\d{2})?)/.exec(line.replace(/,/g, ''));
      if (m) totalRs = parseFloat(m[1]!);
      continue;
    }

    // Item lines
    const m = LINE_RE.exec(line);
    if (m) {
      const [, name, qty, unit, price] = m;
      items.push({
        name:     (name!).trim(),
        quantity: parseFloat(qty!),
        unit:     (unit ?? 'units').toLowerCase(),
        priceRs:  parseFloat(price!),
      });
    }
  }

  return { storeName, billDate, totalRs, items };
}

// ── LLM-assisted parse ────────────────────────────────────────────────────────
const SYSTEM = `You parse Indian grocery store receipts. Extract a JSON object with fields:
{
  "storeName": string | null,
  "billDate": "YYYY-MM-DD" | null,
  "totalRs": number | null,
  "items": [{"name": string, "quantity": number, "unit": string, "priceRs": number | null}]
}
Rules:
- Normalise Indian dates (DD/MM/YY, DD-MM-YYYY, "07 Jul 2026") to YYYY-MM-DD.
- Unit should be one of: g, kg, ml, l, nos, pcs, packet, units.
- Do not invent items not on the receipt.
- Return only the JSON object, no markdown.`;

export async function parseReceipt(opts: {
  text:     string;
  gateway?: GatewayRouter;
}): Promise<ParsedReceipt> {
  const { text, gateway } = opts;

  if (gateway) {
    try {
      const res = await gateway.complete({
        traceId:      `pantry-receipt-${Date.now()}`,
        tier:         'parse_assist',
        systemPrompt: SYSTEM,
        messages:     [{ role: 'user', content: text }],
        maxTokens:    1000,
        temperature:  0,
      });
      const raw = res.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw) as ParsedReceipt;
      if (!Array.isArray(parsed.items)) throw new Error('bad shape');
      return parsed;
    } catch {
      // fall through to regex
    }
  }

  return regexParseReceipt(text);
}

/** Parse receipt and upsert pantry items. Returns receipt DB row id. */
export async function parseAndSavePantryItems(opts: {
  userId:   string;
  text:     string;
  supabase: SupabaseClient;
  gateway?: GatewayRouter;
}): Promise<{ receiptId: string; itemCount: number }> {
  const { userId, text, supabase, gateway } = opts;

  const receipt = await parseReceipt({ text, gateway });
  const purchaseDate = receipt.billDate ?? new Date().toISOString().slice(0, 10);

  const { data: receiptRow, error: rErr } = await supabase
    .from('pantry_receipts')
    .insert({
      user_id:     userId,
      raw_text:    text,
      store_name:  receipt.storeName ?? null,
      bill_date:   purchaseDate,
      total_rs:    receipt.totalRs ?? null,
      items_count: receipt.items.length,
      status:      'processed',
    })
    .select('id')
    .single();

  if (rErr || !receiptRow) throw new Error(`pantry_receipts insert: ${rErr?.message}`);

  if (receipt.items.length > 0) {
    await supabase.from('pantry_items').insert(
      receipt.items.map((item) => ({
        user_id:       userId,
        name:          item.name,
        quantity:      item.quantity,
        unit:          item.unit,
        estimated_rs:  item.priceRs ?? null,
        purchase_date: purchaseDate,
        expiry_date:   estimateExpiry(item.name, purchaseDate) ?? null,
        source:        'receipt_ocr',
      })),
    );
  }

  return { receiptId: receiptRow.id as string, itemCount: receipt.items.length };
}
