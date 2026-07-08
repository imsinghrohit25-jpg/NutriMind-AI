import { describe, it, expect } from 'vitest';
import { privacyRegimeFor, consentRequirementsFor, ALL_CONSENT_TYPES } from '../regime.js';

describe('privacyRegimeFor', () => {
  it('resolves DPDP for India', () => {
    expect(privacyRegimeFor('IN')).toBe('DPDP');
  });

  it('is case-insensitive', () => {
    expect(privacyRegimeFor('in')).toBe('DPDP');
  });

  it('resolves GDPR for EU/UK countries', () => {
    for (const iso of ['GB', 'DE', 'FR', 'IT', 'ES', 'NL']) {
      expect(privacyRegimeFor(iso)).toBe('GDPR');
    }
  });

  it('defaults to GENERIC for every other country', () => {
    for (const iso of ['US', 'AE', 'SG', 'AU', 'JP', 'GLOBAL']) {
      expect(privacyRegimeFor(iso)).toBe('GENERIC');
    }
  });
});

describe('consentRequirementsFor', () => {
  it('GDPR requires explicit, granular health_data consent (Art. 9 special category)', () => {
    const reqs = consentRequirementsFor('GDPR');
    const healthData = reqs.find((r) => r.consentType === 'health_data')!;
    expect(healthData.mandatory).toBe(true);
    expect(healthData.granular).toBe(true);
  });

  it('DPDP requires explicit, granular health_data consent (Sec. 6)', () => {
    const reqs = consentRequirementsFor('DPDP');
    const healthData = reqs.find((r) => r.consentType === 'health_data')!;
    expect(healthData.mandatory).toBe(true);
    expect(healthData.granular).toBe(true);
  });

  it('GENERIC baseline treats health_data as optional opt-in', () => {
    const reqs = consentRequirementsFor('GENERIC');
    const healthData = reqs.find((r) => r.consentType === 'health_data')!;
    expect(healthData.mandatory).toBe(false);
  });

  it('marketing is never mandatory in any regime', () => {
    for (const regime of ['GDPR', 'DPDP', 'GENERIC'] as const) {
      const marketing = consentRequirementsFor(regime).find((r) => r.consentType === 'marketing')!;
      expect(marketing.mandatory).toBe(false);
      expect(marketing.granular).toBe(true);
    }
  });

  it('every regime covers every consent type exactly once', () => {
    for (const regime of ['GDPR', 'DPDP', 'GENERIC'] as const) {
      const reqs = consentRequirementsFor(regime);
      const types = reqs.map((r) => r.consentType);
      expect(new Set(types).size).toBe(types.length);
      expect(types.sort()).toEqual([...ALL_CONSENT_TYPES].sort());
    }
  });

  it('every requirement carries a non-empty citation', () => {
    for (const regime of ['GDPR', 'DPDP', 'GENERIC'] as const) {
      for (const req of consentRequirementsFor(regime)) {
        expect(req.citation.length).toBeGreaterThan(0);
      }
    }
  });
});
