// Receipt OCR deterministic tests — date parsing and regex fallback.

import { describe, it, expect } from 'vitest';
import { parseIndianDate, parseReceipt } from '../receipt-ocr.js';

describe('parseIndianDate', () => {
  it('parses DD/MM/YYYY', () => {
    expect(parseIndianDate('07/07/2026')).toBe('2026-07-07');
  });

  it('parses DD/MM/YY with 20xx century', () => {
    expect(parseIndianDate('07/07/26')).toBe('2026-07-07');
  });

  it('parses DD-MM-YYYY', () => {
    expect(parseIndianDate('15-03-2026')).toBe('2026-03-15');
  });

  it('parses DD MMM YYYY text format', () => {
    expect(parseIndianDate('07 Jul 2026')).toBe('2026-07-07');
  });

  it('parses D Month YYYY', () => {
    expect(parseIndianDate('1 January 2026')).toBe('2026-01-01');
  });

  it('returns undefined for invalid input', () => {
    expect(parseIndianDate('not-a-date')).toBeUndefined();
  });
});

describe('parseReceipt (regex fallback)', () => {
  it('extracts items from simple structured receipt', async () => {
    const text = [
      'BIG BAZAAR',
      'Date: 07/07/2026',
      'Toor Dal    1   kg   120.00',
      'Milk        2   nos   36.00',
      'Amul Ghee   500 g   280.00',
      'Total: 436.00',
    ].join('\n');

    const result = await parseReceipt({ text });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.totalRs).toBe(436);
  });

  it('parses bill date from receipt text', async () => {
    const text = 'SUPERMART\nDate: 01-03-2026\nRice 1 kg 60.00\nTotal: 60.00';
    const result = await parseReceipt({ text });
    expect(result.billDate).toBe('2026-03-01');
  });

  it('returns empty items for unparseable text', async () => {
    const result = await parseReceipt({ text: 'lorem ipsum dolor' });
    expect(result.items).toHaveLength(0);
  });
});
