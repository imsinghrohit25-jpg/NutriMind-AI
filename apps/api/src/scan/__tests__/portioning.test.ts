import { describe, it, expect } from 'vitest';
import { estimatePortion } from '../meal-photo/portioning.js';

describe('estimatePortion', () => {
  it('returns standard serving for known dish', () => {
    const r = estimatePortion('roti', null);
    expect(r.portionGrams).toBe(40);
    expect(r.confidence).toBe('high');
    expect(r.method).toBe('standard_serving');
  });

  it('scales for large serving', () => {
    const r = estimatePortion('rice', 'large bowl');
    expect(r.portionGrams).toBe(225); // 150 * 1.5
    expect(r.method).toBe('hint_parsed');
  });

  it('scales for small serving', () => {
    const r = estimatePortion('dal', 'small katori');
    expect(r.portionGrams).toBe(Math.round(180 * 0.7));
    expect(r.method).toBe('hint_parsed');
  });

  it('returns explicit grams from hint', () => {
    const r = estimatePortion('chicken curry', '200g portion');
    expect(r.portionGrams).toBe(200);
    expect(r.confidence).toBe('high');
  });

  it('returns default 150g for unknown dish', () => {
    const r = estimatePortion('some unknown dish xyz', null);
    expect(r.portionGrams).toBe(150);
    expect(r.confidence).toBe('low');
    expect(r.method).toBe('default_guess');
  });

  it('handles half portion', () => {
    const r = estimatePortion('samosa', 'half');
    expect(r.portionGrams).toBe(Math.round(60 * 0.5));
  });

  it('handles gulab jamun', () => {
    const r = estimatePortion('gulab jamun', '2 pieces');
    expect(r.portionGrams).toBe(Math.round(50 * 2.0));
  });
});
