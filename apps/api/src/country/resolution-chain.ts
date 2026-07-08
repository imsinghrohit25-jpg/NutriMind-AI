// Country resolution chain — 6 steps, first non-null result wins.
//
// API-side resolution (mobile client has already done SIM + stored-profile steps
// and sends the resolved code in x-user-country):
//
//  Step 1: x-user-country header   (explicit client override — includes SIM + profile from client)
//  Step 2: Accept-Language region  (OS locale region subtag)
//  Step 3: CF-IPCountry header     (Cloudflare geo, set by edge)
//  Step 4: x-country-code header   (custom API-gateway header)
//  Step 5: GLOBAL fallback

import type { FastifyRequest } from 'fastify';
import { GLOBAL_PROFILE, INDIA_PROFILE } from './types.js';
import type { CountryProfile } from './types.js';
import { lookupCountry, regionFromLocale } from './registry.js';

export interface ResolutionTrace {
  resolvedBy: string;
  candidate:  string;
  profile:    CountryProfile;
}

/**
 * Resolve CountryProfile from request headers.
 * Returns a trace for observability.
 */
export function resolveCountryFromRequest(request: FastifyRequest): ResolutionTrace {
  const h = request.headers;

  // Step 1: Explicit client override (the mobile client sends its fully-resolved code here)
  const clientOverride = normalizeCode(h['x-user-country'] as string | undefined);
  if (clientOverride) {
    const profile = lookupCountry(clientOverride);
    if (profile) return { resolvedBy: 'x-user-country', candidate: clientOverride, profile };
  }

  // Step 2: Accept-Language region subtag
  const acceptLang = h['accept-language'] as string | undefined;
  if (acceptLang) {
    const region = regionFromAcceptLanguage(acceptLang);
    if (region) {
      const profile = lookupCountry(region);
      if (profile) return { resolvedBy: 'accept-language', candidate: region, profile };
    }
  }

  // Step 3: Cloudflare IP geolocation header
  const cfCountry = normalizeCode(h['cf-ipcountry'] as string | undefined);
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
    const profile = lookupCountry(cfCountry);
    if (profile) return { resolvedBy: 'cf-ipcountry', candidate: cfCountry, profile };
  }

  // Step 4: Custom gateway header (set by nginx/ALB/etc.)
  const xCountry = normalizeCode(h['x-country-code'] as string | undefined);
  if (xCountry) {
    const profile = lookupCountry(xCountry);
    if (profile) return { resolvedBy: 'x-country-code', candidate: xCountry, profile };
  }

  // Step 5: GLOBAL fallback
  return { resolvedBy: 'fallback', candidate: 'GLOBAL', profile: GLOBAL_PROFILE };
}

/**
 * Resolve with feature-flag awareness.
 * When the country_engine flag is OFF, returns the India default for all requests
 * to preserve backward compatibility.
 */
export function resolveCountry(
  request:          FastifyRequest,
  engineEnabled:    boolean,
): CountryProfile {
  if (!engineEnabled) return INDIA_PROFILE;
  return resolveCountryFromRequest(request).profile;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeCode(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const code = raw.trim().split(',')[0]!.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function regionFromAcceptLanguage(header: string): string | null {
  // Accept-Language: en-US,en;q=0.9,hi;q=0.8
  // Take the highest-priority tag (first) and extract region.
  const firstTag = header.split(',')[0]!.split(';')[0]!.trim();
  return regionFromLocale(firstTag);
}
