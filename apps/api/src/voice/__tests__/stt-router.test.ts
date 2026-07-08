// STT routing decision tests — Phase 6 (`global.p6.cloud_stt`).

import { describe, it, expect } from 'vitest';
import { sttStrategyFor } from '../stt-router.js';
import type { CountryTier } from '../../country/types.js';

describe('sttStrategyFor', () => {
  it('routes tier1 countries to on-device STT', () => {
    expect(sttStrategyFor('tier1')).toBe('on_device');
  });

  it('routes tier2 countries to cloud STT', () => {
    expect(sttStrategyFor('tier2')).toBe('cloud');
  });

  it('routes fallback (unrecognised) countries to cloud STT', () => {
    expect(sttStrategyFor('fallback')).toBe('cloud');
  });

  it('is exhaustive over every CountryTier value', () => {
    const tiers: CountryTier[] = ['tier1', 'tier2', 'fallback'];
    for (const tier of tiers) {
      expect(['on_device', 'cloud']).toContain(sttStrategyFor(tier));
    }
  });
});
