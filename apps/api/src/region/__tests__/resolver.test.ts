import { describe, it, expect } from 'vitest';
import { resolveDataRegion } from '../resolver.js';

describe('resolveDataRegion', () => {
  it('targets eu-west-1 for EU/UK GDPR countries', () => {
    for (const iso of ['GB', 'DE', 'FR', 'IT', 'ES', 'NL']) {
      const r = resolveDataRegion(iso);
      expect(r.target).toBe('eu-west-1');
      expect(r.residencyRequired).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(resolveDataRegion('de').target).toBe('eu-west-1');
  });

  it('targets us-east-1 for North America', () => {
    for (const iso of ['US', 'CA', 'MX']) {
      const r = resolveDataRegion(iso);
      expect(r.target).toBe('us-east-1');
      expect(r.residencyRequired).toBe(false);
    }
  });

  it('defaults to ap-south-1 for every other country', () => {
    for (const iso of ['IN', 'AE', 'SG', 'AU', 'JP', 'KR', 'BR', 'ID', 'GLOBAL']) {
      expect(resolveDataRegion(iso).target).toBe('ap-south-1');
    }
  });

  it('active region is always ap-south-1 today — the sole live deployment', () => {
    expect(resolveDataRegion('DE').active).toBe('ap-south-1');
    expect(resolveDataRegion('IN').active).toBe('ap-south-1');
    expect(resolveDataRegion('US').active).toBe('ap-south-1');
  });

  it('residencySatisfied is true only when target matches the active region', () => {
    expect(resolveDataRegion('IN').residencySatisfied).toBe(true);   // target === active
    expect(resolveDataRegion('DE').residencySatisfied).toBe(false);  // EU target, not yet live
    expect(resolveDataRegion('US').residencySatisfied).toBe(false);  // US target, not yet live
  });

  it('never fabricates residency compliance for a residency-required country', () => {
    const r = resolveDataRegion('DE');
    expect(r.residencyRequired).toBe(true);
    expect(r.residencySatisfied).toBe(false);
  });
});
