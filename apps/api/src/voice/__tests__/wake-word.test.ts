// Wake-word availability tests — Phase 6 (`global.p6.wake_word`), graceful-degradation shape
// (mirrors chain-loader.test.ts's "no dataset installed" pattern for ADR-0018).

import { describe, it, expect } from 'vitest';
import { wakeWordAvailability } from '../wake-word.js';

describe('wakeWordAvailability', () => {
  it('is unavailable for en — no bundled keyword model exists yet', () => {
    const result = wakeWordAvailability('en');
    expect(result.available).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('is unavailable for hi — no bundled keyword model exists yet', () => {
    expect(wakeWordAvailability('hi').available).toBe(false);
  });

  it('is unavailable for mr — no bundled keyword model exists yet', () => {
    expect(wakeWordAvailability('mr').available).toBe(false);
  });

  it('never throws for a supported locale', () => {
    expect(() => wakeWordAvailability('en')).not.toThrow();
  });
});
