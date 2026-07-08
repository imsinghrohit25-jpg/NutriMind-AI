import { describe, it, expect } from 'vitest';
import { assembleMemoryContext } from '../context-assembler.js';
import type { StoredMemoryFact } from '../facts-service.js';

function fact(overrides: Partial<StoredMemoryFact>): StoredMemoryFact {
  return {
    factId: overrides.factId ?? Math.random().toString(36),
    factType: 'eating_pattern',
    factKey: 'meal_timing_breakfast',
    value: { avgHourUtc: 8 },
    confidence: 0.8,
    derivedFrom: ['e1'],
    computedAt: new Date('2026-01-01'),
    validUntil: new Date('2026-06-01'),
    ...overrides,
  };
}

describe('assembleMemoryContext', () => {
  it('renders known fact keys into deterministic, human-readable lines', () => {
    const pack = assembleMemoryContext('user-1', [
      fact({ factType: 'health_goal', factKey: 'active_goal', value: { goal: 'lose', kcalTarget: 1800 } }),
    ]);
    expect(pack.sections.health_goal).toEqual(['Current goal: lose (~1800 kcal/day target).']);
    expect(pack.factIds.length).toBe(1);
  });

  it('is deterministic — identical input produces an identical content hash', () => {
    const facts = [fact({ factId: 'f1' })];
    const pack1 = assembleMemoryContext('user-1', facts);
    const pack2 = assembleMemoryContext('user-1', facts);
    expect(pack1.contentHash).toBe(pack2.contentHash);
  });

  it('drops unknown/unrenderable fact keys silently rather than emitting garbage', () => {
    const pack = assembleMemoryContext('user-1', [fact({ factKey: 'some_unmapped_key', value: {} })]);
    expect(pack.sections).toEqual({});
    expect(pack.factIds).toEqual([]);
  });

  it('truncates lowest-confidence facts first once the token budget is exceeded', () => {
    const facts = [
      fact({ factId: 'high', factType: 'health_goal', factKey: 'active_goal', value: { goal: 'lose' }, confidence: 0.9 }),
      fact({ factId: 'low', factType: 'health_goal', factKey: 'current_streak_days', value: { streakDays: 3 }, confidence: 0.1 }),
    ];
    const pack = assembleMemoryContext('user-1', facts, { maxTokens: 8 }); // tiny budget — only room for one line
    expect(pack.factIds).toEqual(['high']); // higher-confidence fact survives
  });

  it('redacts email-looking substrings defensively even though facts are statistical', () => {
    const pack = assembleMemoryContext('user-1', [
      fact({ factType: 'health_goal', factKey: 'active_goal', value: { goal: 'contact me at a@b.com' } }),
    ]);
    expect(pack.sections.health_goal![0]).not.toContain('a@b.com');
    expect(pack.sections.health_goal![0]).toContain('[redacted-email]');
  });

  it('orders sections by a fixed priority (health_goal first) regardless of input order', () => {
    const facts = [
      fact({ factType: 'travel_history', factKey: 'travel_timeline', value: { travelMode: true, currentIsoCode: 'GB' } }),
      fact({ factType: 'health_goal', factKey: 'active_goal', value: { goal: 'lose' } }),
    ];
    const pack = assembleMemoryContext('user-1', facts);
    expect(Object.keys(pack.sections)[0]).toBe('health_goal');
  });
});
