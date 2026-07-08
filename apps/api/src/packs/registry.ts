// Known regional packs — Phase 9 (`global.p9.incremental_regional_sync`).
// Mirrors `kKnownRegionalPacks` in packages/food_intelligence/lib/src/regional_food_pack.dart,
// minus the fabricated `cdn.nutrimind.app` download URLs that file previously carried (no such
// CDN exists — see ADR-0023). USDA is intentionally not listed here: it's a live API client
// (`datasources/usda/client.ts`), not a locally-loaded bulk dataset, so "sync a snapshot" isn't
// a meaningful operation for it the way it is for IFCT/CoFID.

import type { PackDefinition } from './types.js';

export const PACK_REGISTRY: readonly PackDefinition[] = [
  { packId: 'ifct_in_2017', countryCode: 'IN', dataSourceId: 'ifct_2017', displayName: 'India food pack (IFCT 2017)', datasetVersion: '2017' },
  { packId: 'cofid_gb_2021', countryCode: 'GB', dataSourceId: 'cofid_2021', displayName: 'UK food pack (CoFID 2021)', datasetVersion: '2021' },
];

export function getPackDefinition(packId: string): PackDefinition | undefined {
  return PACK_REGISTRY.find((p) => p.packId === packId);
}
