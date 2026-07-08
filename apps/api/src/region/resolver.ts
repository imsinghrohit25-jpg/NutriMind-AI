// Data region resolution — Phase 7 (`global.p7.multi_region_routing`).
// Answers "which region should this request/data target?" as a real, tested policy decision.
// Only one region (`ap-south-1`) is actually provisioned today (see ADR-0020) — provisioning
// `eu-west-1`/`us-east-1` and building the cross-region data-sync/routing infra to act on a
// non-default `target` is out of scope for this phase (would require real cloud infra
// this environment cannot provision). `residencySatisfied` makes that gap visible rather than
// silently claiming compliance NutriMind cannot yet deliver.

import type { DataRegion } from './types.js';
import { ACTIVE_REGION, targetRegionFor, residencyRequiredFor } from './registry.js';

export interface DataRegionResolution {
  /** The region this country's traffic/data should route to (residency policy + latency). */
  target: DataRegion;
  /** The region actually serving this request today. */
  active: DataRegion;
  /** True when `target` is a GDPR/UK GDPR legal requirement, not just a latency preference. */
  residencyRequired: boolean;
  /** True when `active` already equals `target` — i.e. residency is actually met today. */
  residencySatisfied: boolean;
}

export function resolveDataRegion(isoCode: string): DataRegionResolution {
  const target = targetRegionFor(isoCode);
  const residencyRequired = residencyRequiredFor(isoCode);
  return {
    target,
    active: ACTIVE_REGION,
    residencyRequired,
    residencySatisfied: ACTIVE_REGION === target,
  };
}

export { REGION_REGISTRY, ACTIVE_REGION } from './registry.js';
export type { DataRegion, RegionInfo } from './types.js';
