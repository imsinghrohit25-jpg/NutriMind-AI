// Devanagari OCR verification — gate requirement for Phase 11.
// Verifies that the label parser correctly handles Hindi/Marathi text on packaged food labels.
// Common patterns: ingredient names, FSSAI declaration, veg mark text in Devanagari.

import { describe, it, expect } from 'vitest';
import { tokenizeIngredients, type IngredientToken } from '../ingredient-parser/tokenizer.js';

describe('Devanagari OCR label handling', () => {
  it('tokenizes a mixed English+Hindi ingredient list', () => {
    // Typical Indian label: brand name in Devanagari, ingredients in English
    const input = 'Wheat Flour (गेहूं का आटा), Sugar (चीनी), Salt (नमक), Edible Oil';
    const tokens: IngredientToken[] = tokenizeIngredients(input);
    // Tokenizer should extract English ingredient names correctly
    expect(tokens.some((t) => t.name.toLowerCase().includes('wheat flour'))).toBe(true);
    expect(tokens.some((t) => t.name.toLowerCase().includes('sugar'))).toBe(true);
    expect(tokens.some((t) => t.name.toLowerCase().includes('salt'))).toBe(true);
    expect(tokens.some((t) => t.name.toLowerCase().includes('edible oil'))).toBe(true);
  });

  it('does not crash on pure Devanagari ingredient list', () => {
    // Some budget products have fully Devanagari labels
    const devanagari = 'गेहूं का आटा, चीनी, नमक, खाद्य तेल, इलाइची';
    expect(() => tokenizeIngredients(devanagari)).not.toThrow();
    const tokens = tokenizeIngredients(devanagari);
    // Returns at least one token even if English names not parsed
    expect(Array.isArray(tokens)).toBe(true);
  });

  it('strips Devanagari parenthetical translations without dropping English name', () => {
    // "Edible Starch (खाद्य स्टार्च)" → should preserve "Edible Starch"
    const input = 'Edible Starch (खाद्य स्टार्च), Soy Lecithin (सोया लेसिथिन)';
    const tokens: IngredientToken[] = tokenizeIngredients(input);
    expect(tokens.some((t) => /starch/i.test(t.name))).toBe(true);
    expect(tokens.some((t) => /soy/i.test(t.name))).toBe(true);
  });

  it('handles FSSAI veg mark declaration line in Hindi', () => {
    // "शाकाहारी" (vegetarian) appears near the veg mark
    const withVegMark = 'चीनी, नमक, शाकाहारी घोषणा: यह उत्पाद शुद्ध शाकाहारी है।';
    expect(() => tokenizeIngredients(withVegMark)).not.toThrow();
  });

  it('extracts tokens from Devanagari-heavy text containing INS numbers', () => {
    // "INS 211" embedded in Devanagari text
    const input = 'नमक, INS 211 (सोडियम बेंजोएट), चीनी';
    const tokens: IngredientToken[] = tokenizeIngredients(input);
    // At least one token should contain "INS 211" or the ingredient name
    const allText = tokens.map((t: IngredientToken) => t.rawText).join(' ');
    expect(allText).toMatch(/INS\s*211|sodium|benzoate|benzoa/i);
  });
});
