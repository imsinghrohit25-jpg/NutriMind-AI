import { describe, it, expect } from 'vitest';
import { tokenizeIngredients } from '../ingredient-parser/tokenizer.js';

describe('tokenizeIngredients', () => {
  it('handles simple comma-separated list', () => {
    const tokens = tokenizeIngredients('Wheat Flour, Sugar, Salt, Edible Vegetable Oil');
    expect(tokens).toHaveLength(4);
    expect(tokens[0]?.name).toBe('Wheat Flour');
    expect(tokens[1]?.name).toBe('Sugar');
  });

  it('extracts percentage in parentheses', () => {
    const tokens = tokenizeIngredients('Wheat Flour (72%), Sugar, Salt');
    const flour = tokens[0];
    expect(flour?.name).toBe('Wheat Flour');
    expect(flour?.percentage).toBeCloseTo(72);
  });

  it('handles nested sub-ingredients', () => {
    const tokens = tokenizeIngredients('Edible Vegetable Oil (Palm, Sunflower), Salt');
    const oil = tokens[0];
    expect(oil?.name).toBe('Edible Vegetable Oil');
    expect(oil?.subIngredients.length).toBeGreaterThan(0);
    expect(oil?.subIngredients[0]?.name).toMatch(/Palm/i);
  });

  it('strips "Ingredients:" prefix', () => {
    const tokens = tokenizeIngredients('Ingredients: Wheat, Sugar, Salt');
    expect(tokens[0]?.name).toBe('Wheat');
  });

  it('handles trailing percentage without parentheses', () => {
    const tokens = tokenizeIngredients('Whole Wheat 60%, Refined Flour 30%, Sugar 10%');
    expect(tokens[0]?.percentage).toBeCloseTo(60);
    expect(tokens[1]?.percentage).toBeCloseTo(30);
    expect(tokens[2]?.percentage).toBeCloseTo(10);
  });

  it('returns empty array for empty input', () => {
    expect(tokenizeIngredients('')).toHaveLength(0);
    expect(tokenizeIngredients('  ')).toHaveLength(0);
  });

  it('handles real Indian biscuit ingredient list', () => {
    const raw = 'Refined Wheat Flour (Maida) (68%), Sugar, Edible Vegetable Oil (Palm) (16%), Invert Syrup, Leavening Agents (INS 500(ii), INS 503(ii)), Salt, Vanilla Flavour (Natural & Artificial)';
    const tokens = tokenizeIngredients(raw);
    expect(tokens.length).toBeGreaterThanOrEqual(7);
    const flour = tokens.find((t: { name: string }) => t.name.toLowerCase().includes('wheat'));
    expect(flour).toBeDefined();
    expect(flour?.percentage).toBeCloseTo(68);
  });
});
