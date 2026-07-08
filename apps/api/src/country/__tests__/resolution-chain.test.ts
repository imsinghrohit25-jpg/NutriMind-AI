/**
 * Phase 1 — Country Resolution Chain unit tests.
 * Tests all 5 resolution steps + feature-flag OFF backward-compatibility.
 */

import { describe, it, expect } from 'vitest';
import type { FastifyRequest } from 'fastify';
import {
  resolveCountryFromRequest,
  resolveCountry,
} from '../resolution-chain.js';
import { GLOBAL_PROFILE, INDIA_PROFILE } from '../types.js';

/** Minimal FastifyRequest mock */
function req(headers: Record<string, string>): FastifyRequest {
  return { headers, log: { debug: () => {} } } as unknown as FastifyRequest;
}

describe('Country resolution chain', () => {
  describe('Step 1 — x-user-country header', () => {
    it('resolves known Tier-1 country from x-user-country', () => {
      const r = resolveCountryFromRequest(req({ 'x-user-country': 'US' }));
      expect(r.profile.isoCode).toBe('US');
      expect(r.resolvedBy).toBe('x-user-country');
    });

    it('resolves Tier-2 country from x-user-country', () => {
      const r = resolveCountryFromRequest(req({ 'x-user-country': 'JP' }));
      expect(r.profile.isoCode).toBe('JP');
    });

    it('falls through for unknown ISO code in x-user-country', () => {
      const r = resolveCountryFromRequest(req({ 'x-user-country': 'ZZ' }));
      expect(r.resolvedBy).not.toBe('x-user-country');
    });

    it('is case-insensitive', () => {
      const r = resolveCountryFromRequest(req({ 'x-user-country': 'de' }));
      expect(r.profile.isoCode).toBe('DE');
    });
  });

  describe('Step 2 — Accept-Language region', () => {
    it('extracts region from simple locale', () => {
      const r = resolveCountryFromRequest(req({ 'accept-language': 'en-GB' }));
      expect(r.profile.isoCode).toBe('GB');
      expect(r.resolvedBy).toBe('accept-language');
    });

    it('uses first tag in multi-value header', () => {
      const r = resolveCountryFromRequest(req({
        'accept-language': 'en-AU,en;q=0.9',
      }));
      expect(r.profile.isoCode).toBe('AU');
    });

    it('falls through when region not in registry', () => {
      const r = resolveCountryFromRequest(req({ 'accept-language': 'en-ZZ' }));
      expect(r.resolvedBy).not.toBe('accept-language');
    });

    it('falls through when locale has no region subtag', () => {
      const r = resolveCountryFromRequest(req({ 'accept-language': 'en' }));
      expect(r.resolvedBy).not.toBe('accept-language');
    });
  });

  describe('Step 3 — CF-IPCountry header', () => {
    it('uses Cloudflare country header', () => {
      const r = resolveCountryFromRequest(req({ 'cf-ipcountry': 'CA' }));
      expect(r.profile.isoCode).toBe('CA');
      expect(r.resolvedBy).toBe('cf-ipcountry');
    });

    it('ignores CF sentinel value XX (unknown IP)', () => {
      const r = resolveCountryFromRequest(req({ 'cf-ipcountry': 'XX' }));
      expect(r.resolvedBy).not.toBe('cf-ipcountry');
    });

    it('ignores CF sentinel value T1 (Tor)', () => {
      const r = resolveCountryFromRequest(req({ 'cf-ipcountry': 'T1' }));
      expect(r.resolvedBy).not.toBe('cf-ipcountry');
    });
  });

  describe('Step 4 — x-country-code header', () => {
    it('uses custom gateway header', () => {
      const r = resolveCountryFromRequest(req({ 'x-country-code': 'SG' }));
      expect(r.profile.isoCode).toBe('SG');
      expect(r.resolvedBy).toBe('x-country-code');
    });
  });

  describe('Step 5 — GLOBAL fallback', () => {
    it('returns GLOBAL when no headers present', () => {
      const r = resolveCountryFromRequest(req({}));
      expect(r.profile).toEqual(GLOBAL_PROFILE);
      expect(r.resolvedBy).toBe('fallback');
    });

    it('returns GLOBAL when all headers contain unknown codes', () => {
      const r = resolveCountryFromRequest(req({
        'x-user-country': 'ZZ',
        'accept-language': 'en',
        'cf-ipcountry': 'XX',
        'x-country-code': '??',
      }));
      expect(r.resolvedBy).toBe('fallback');
    });
  });

  describe('Priority ordering', () => {
    it('x-user-country wins over accept-language and cf-ipcountry', () => {
      const r = resolveCountryFromRequest(req({
        'x-user-country':  'US',
        'accept-language': 'en-GB',
        'cf-ipcountry':    'AU',
      }));
      expect(r.profile.isoCode).toBe('US');
      expect(r.resolvedBy).toBe('x-user-country');
    });

    it('accept-language wins over cf-ipcountry', () => {
      const r = resolveCountryFromRequest(req({
        'accept-language': 'en-IN',
        'cf-ipcountry':    'AU',
      }));
      expect(r.profile.isoCode).toBe('IN');
      expect(r.resolvedBy).toBe('accept-language');
    });
  });

  describe('Feature flag backward compat', () => {
    it('returns INDIA_PROFILE when flag is OFF regardless of headers', () => {
      const profile = resolveCountry(
        req({ 'x-user-country': 'US', 'cf-ipcountry': 'US' }),
        false, // flag OFF
      );
      expect(profile).toEqual(INDIA_PROFILE);
      expect(profile.isoCode).toBe('IN');
    });

    it('runs chain when flag is ON', () => {
      const profile = resolveCountry(
        req({ 'x-user-country': 'AE' }),
        true, // flag ON
      );
      expect(profile.isoCode).toBe('AE');
    });
  });

  describe('CountryProfile shape', () => {
    it('resolved profile has all required fields', () => {
      const r = resolveCountryFromRequest(req({ 'x-user-country': 'DE' }));
      const p = r.profile;
      expect(typeof p.isoCode).toBe('string');
      expect(typeof p.tier).toBe('string');
      expect(typeof p.displayName).toBe('string');
      expect(typeof p.locale).toBe('string');
      expect(typeof p.currencyCode).toBe('string');
      expect(typeof p.rtl).toBe('boolean');
      expect(typeof p.allergenRegime).toBe('string');
      expect(typeof p.nutritionStandard).toBe('string');
      expect(Array.isArray(p.mccList)).toBe(true);
    });

    it('RTL is true for AE (Arabic)', () => {
      const r = resolveCountryFromRequest(req({ 'x-user-country': 'AE' }));
      expect(r.profile.rtl).toBe(true);
    });

    it('RTL is false for India', () => {
      expect(INDIA_PROFILE.rtl).toBe(false);
    });

    it('India allergen regime is FSSAI_8', () => {
      expect(INDIA_PROFILE.allergenRegime).toBe('FSSAI_8');
    });

    it('US allergen regime is FDA_9_SESAME', () => {
      const r = resolveCountryFromRequest(req({ 'x-user-country': 'US' }));
      expect(r.profile.allergenRegime).toBe('FDA_9_SESAME');
    });

    it('EU countries allergen regime is EU_14', () => {
      for (const code of ['GB', 'DE', 'FR', 'IT', 'ES', 'NL']) {
        const r = resolveCountryFromRequest(req({ 'x-user-country': code }));
        expect(r.profile.allergenRegime).toBe('EU_14');
      }
    });
  });

  describe('Registry completeness', () => {
    it('all 8 Tier-1 countries resolve', () => {
      for (const code of ['IN', 'US', 'GB', 'AE', 'SG', 'AU', 'CA', 'DE']) {
        const r = resolveCountryFromRequest(req({ 'x-user-country': code }));
        expect(r.profile.tier).toBe('tier1');
        expect(r.profile.isoCode).toBe(code);
      }
    });

    it('all 17 Tier-2 countries resolve', () => {
      for (const code of ['JP','FR','KR','BR','MX','ID','TH','MY','PH','VN','ZA','NG','EG','SA','IT','ES','NL']) {
        const r = resolveCountryFromRequest(req({ 'x-user-country': code }));
        expect(r.profile.tier).toBe('tier2');
        expect(r.profile.isoCode).toBe(code);
      }
    });
  });
});
