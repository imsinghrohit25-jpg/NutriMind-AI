// Voice NLU unit tests — Hinglish quantity/unit resolution (no LLM calls).

import { describe, it, expect } from 'vitest';
import { resolveQuantity, resolveUnit } from '../nlu.js';

describe('resolveQuantity', () => {
  it('resolves Hindi numerals', () => {
    expect(resolveQuantity('ek')).toBe(1);
    expect(resolveQuantity('do')).toBe(2);
    expect(resolveQuantity('teen')).toBe(3);
    expect(resolveQuantity('char')).toBe(4);
    expect(resolveQuantity('paanch')).toBe(5);
    expect(resolveQuantity('das')).toBe(10);
  });

  it('resolves fractional Hindi quantities', () => {
    expect(resolveQuantity('adha')).toBe(0.5);
    expect(resolveQuantity('aadha')).toBe(0.5);
    expect(resolveQuantity('dedh')).toBe(1.5);
    expect(resolveQuantity('dhai')).toBe(2.5);
    expect(resolveQuantity('pav')).toBe(0.25);
  });

  it('resolves numeric strings', () => {
    expect(resolveQuantity('1')).toBe(1);
    expect(resolveQuantity('2.5')).toBe(2.5);
    expect(resolveQuantity('0.5')).toBe(0.5);
  });

  it('defaults to 1 for unrecognised strings', () => {
    expect(resolveQuantity('kuch')).toBe(1);
    expect(resolveQuantity('')).toBe(1);
  });
});

describe('resolveUnit', () => {
  it('normalises katori variants', () => {
    expect(resolveUnit('katori')).toBe('katori');
    expect(resolveUnit('katora')).toBe('katori');
    expect(resolveUnit('KATORI')).toBe('katori');
  });

  it('normalises roti variants', () => {
    expect(resolveUnit('roti')).toBe('roti');
    expect(resolveUnit('chapati')).toBe('roti');
    expect(resolveUnit('phulka')).toBe('roti');
  });

  it('normalises glass variants', () => {
    expect(resolveUnit('glass')).toBe('glass');
    expect(resolveUnit('gilas')).toBe('glass');
  });

  it('normalises plate variants', () => {
    expect(resolveUnit('plate')).toBe('plate');
    expect(resolveUnit('thali')).toBe('plate');
  });

  it('passes through unknown units unchanged', () => {
    expect(resolveUnit('ml')).toBe('ml');
    expect(resolveUnit('g')).toBe('g');
    expect(resolveUnit('unknown_unit')).toBe('unknown_unit');
  });
});
