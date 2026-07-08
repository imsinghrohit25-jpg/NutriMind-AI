// Regional food pack types — Phase 9 (`global.p9.incremental_regional_sync`).
// A "pack" is an offline-capable snapshot of one country's reference food-composition dataset
// (IFCT 2017 for India, CoFID 2021 for the UK) — the descriptor model Phase 3 defined
// (`packages/food_intelligence/lib/src/regional_food_pack.dart`) but explicitly deferred the
// sync mechanics for (ADR-0016 §6). This phase implements those mechanics for real.

export interface PackDefinition {
  packId: string;
  countryCode: string;
  dataSourceId: string;
  displayName: string;
  /** These reference datasets are versioned as a whole (not per-row), so "incremental" means
   *  "nothing changed since this version" vs. "here's the current full snapshot" — see
   *  sync-service.ts. */
  datasetVersion: string;
}

export interface PackManifestEntry extends PackDefinition {
  itemCount: number;
  /** Whether the underlying dataset is actually loaded in this deployment. Never fabricated —
   *  false when the licensed dataset file (IFCT 2017: ADR risk R-01; CoFID: similar) hasn't
   *  been acquired/placed, same graceful-degradation contract as IfctLoader/CofidLoader. */
  available: boolean;
}

export interface PackSyncItem {
  sourceId: string;
  name: string;
  nutrition: Record<string, unknown>;
}

export interface PackSyncResult {
  packId: string;
  datasetVersion: string;
  /** Empty when the client's `clientVersion` already matches `datasetVersion`, or when the
   *  dataset isn't available server-side — never a partial/fabricated diff. */
  items: PackSyncItem[];
  upToDate: boolean;
}

export class PackNotFoundError extends Error {
  constructor(packId: string) {
    super(`Unknown pack id: ${packId}`);
    this.name = 'PackNotFoundError';
  }
}
