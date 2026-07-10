import { describe, it, expect } from 'vitest';
import { allergenCheckTool } from '../allergen.js';

describe('allergenCheckTool', () => {
  it('returns "block" for a declared allergen match, per member', async () => {
    const result = await allergenCheckTool.execute({
      ingredientNames: ['wheat flour', 'peanut butter', 'sugar'],
      rawLabelText: 'Contains: peanut butter',
      members: [{ memberId: 'm1', memberName: 'Asha', allergens: ['peanut'] }],
      ocrConfidence: 0.95,
      parseQuality: 'high',
    }, {} as never);

    expect(result.members[0]!.verdict).toBe('block');
    expect(result.anyBlocked).toBe(true);
  });

  it('returns "allow" when no allergen matches and OCR confidence is high', async () => {
    const result = await allergenCheckTool.execute({
      ingredientNames: ['rice', 'water', 'salt'],
      rawLabelText: 'Rice, Water, Salt',
      members: [{ memberId: 'm1', memberName: 'Asha', allergens: ['peanut'] }],
      ocrConfidence: 0.95,
      parseQuality: 'high',
    }, {} as never);

    expect(result.members[0]!.verdict).toBe('allow');
    expect(result.anyBlocked).toBe(false);
  });

  it('returns "unverifiable" (never "allow") when OCR confidence is too low — the fail-safe cannot be bypassed by a clean-looking ingredient list', async () => {
    const result = await allergenCheckTool.execute({
      ingredientNames: ['rice', 'water', 'salt'],
      rawLabelText: 'Rice, Water, Salt',
      members: [{ memberId: 'm1', memberName: 'Asha', allergens: ['peanut'] }],
      ocrConfidence: 0.2,
      parseQuality: 'low',
    }, {} as never);

    expect(result.members[0]!.verdict).toBe('unverifiable');
    expect(result.anyUnverifiable).toBe(true);
  });

  it('checks every family member independently — one member\'s allergen never blocks another\'s safe item', async () => {
    const result = await allergenCheckTool.execute({
      ingredientNames: ['milk', 'sugar', 'cocoa'],
      rawLabelText: 'Milk, Sugar, Cocoa',
      members: [
        { memberId: 'm1', memberName: 'Asha', allergens: ['milk'] },
        { memberId: 'm2', memberName: 'Ravi', allergens: ['peanut'] },
      ],
      ocrConfidence: 0.95,
      parseQuality: 'high',
    }, {} as never);

    expect(result.members.find((m) => m.memberId === 'm1')!.verdict).toBe('block');
    expect(result.members.find((m) => m.memberId === 'm2')!.verdict).toBe('allow');
  });

  it('defaults to full confidence when ocrConfidence/parseQuality are omitted (structured DB data, not OCR) — never fail-safes on data that was never OCR\'d', async () => {
    const result = await allergenCheckTool.execute({
      ingredientNames: ['wheat flour', 'peanut butter', 'sugar'],
      rawLabelText: 'Contains: peanut butter',
      members: [{ memberId: 'm1', memberName: 'Asha', allergens: ['peanut'] }],
    }, {} as never);

    expect(result.members[0]!.verdict).toBe('block');
  });

  it('"may contain traces" language yields "unverifiable", not "allow" or a silent pass', async () => {
    const result = await allergenCheckTool.execute({
      ingredientNames: ['oats', 'honey'],
      rawLabelText: 'Oats, Honey. May contain traces of tree nuts.',
      members: [{ memberId: 'm1', memberName: 'Asha', allergens: ['tree_nuts'] }],
      ocrConfidence: 0.95,
      parseQuality: 'high',
    }, {} as never);

    expect(result.members[0]!.verdict).toBe('unverifiable');
  });
});
