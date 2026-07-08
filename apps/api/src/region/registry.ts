// Data region registry — Phase 7 (`global.p7.multi_region_routing`).
// Maps a country to the AWS-style region its traffic/data *should* route to, and flags which
// countries have a legal (not just latency) reason to require that region. See
// `resolver.ts`/ADR-0020 for why `active` (today, always `ap-south-1`) can differ from `target`.

import type { DataRegion, RegionInfo } from './types.js';

export const REGION_REGISTRY: Record<DataRegion, RegionInfo> = {
  'ap-south-1': { id: 'ap-south-1', displayName: 'Asia Pacific (Mumbai)', live: true },
  'eu-west-1':  { id: 'eu-west-1', displayName: 'Europe (Ireland)', live: false },
  'us-east-1':  { id: 'us-east-1', displayName: 'US East (N. Virginia)', live: false },
};

/** The one region that actually has a provisioned deployment today. */
export const ACTIVE_REGION: DataRegion = 'ap-south-1';

// EU/EEA member states in COUNTRY_REGISTRY, plus GB (UK GDPR mirrors EU GDPR post-Brexit,
// Data Protection Act 2018) — GDPR Regulation (EU) 2016/679 residency/transfer rules apply.
const EU_UK_GDPR: ReadonlySet<string> = new Set(['GB', 'DE', 'FR', 'IT', 'ES', 'NL']);

// North America — nearest provisioned-region target once us-east-1 exists.
const NORTH_AMERICA: ReadonlySet<string> = new Set(['US', 'CA', 'MX']);

/** Which region `isoCode`'s traffic/data should target (residency policy + latency). */
export function targetRegionFor(isoCode: string): DataRegion {
  const iso = isoCode.toUpperCase();
  if (EU_UK_GDPR.has(iso)) return 'eu-west-1';
  if (NORTH_AMERICA.has(iso)) return 'us-east-1';
  return 'ap-south-1'; // default anchor — matches the sole live region and INDIA_PROFILE default
}

/** True when `isoCode` has a legal (GDPR/UK GDPR) requirement, not just a latency preference. */
export function residencyRequiredFor(isoCode: string): boolean {
  return EU_UK_GDPR.has(isoCode.toUpperCase());
}
