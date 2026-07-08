// Regional pack sync service — Phase 9 (`global.p9.incremental_regional_sync`).
// Implements the sync mechanics Phase 3 deferred (ADR-0016 §6): given a client's cached
// `datasetVersion`, return either "you're up to date" (empty diff) or the current full
// snapshot. IFCT/CoFID are versioned as a whole dataset release (e.g. "IFCT 2017"), not
// per-row with individual updated_at timestamps — so a real, honest "incremental" sync for a
// reference dataset like this is version-comparison, not a row-level delta. When a new
// dataset version is loaded (e.g. "IFCT 2020"), every client on an older version gets the
// full new snapshot once; no further sync traffic until the next version bump.

import type { IfctLoader } from '../datasources/ifct/loader.js';
import type { CofidLoader } from '../datasources/cofid/loader.js';
import { getPackDefinition, PACK_REGISTRY } from './registry.js';
import { PackNotFoundError, type PackManifestEntry, type PackSyncItem, type PackSyncResult } from './types.js';

export interface PackSyncDeps {
  ifct: IfctLoader;
  cofid: CofidLoader;
}

function itemCountFor(packId: string, deps: PackSyncDeps): number {
  if (packId === 'ifct_in_2017') return deps.ifct.isAvailable() ? deps.ifct.count : 0;
  if (packId === 'cofid_gb_2021') return deps.cofid.isAvailable() ? deps.cofid.size : 0;
  return 0;
}

function isAvailableFor(packId: string, deps: PackSyncDeps): boolean {
  if (packId === 'ifct_in_2017') return deps.ifct.isAvailable();
  if (packId === 'cofid_gb_2021') return deps.cofid.isAvailable();
  return false;
}

function itemsFor(packId: string, deps: PackSyncDeps): PackSyncItem[] {
  if (packId === 'ifct_in_2017') {
    return deps.ifct.getAll().map((entry) => ({
      sourceId: entry.foodCode,
      name: entry.foodNameEn,
      nutrition: deps.ifct.toCanonicalProduct(entry).nutrition ?? {},
    }));
  }
  if (packId === 'cofid_gb_2021') {
    return deps.cofid.getAll().map((food) => ({
      sourceId: food.food_code,
      name: food.food_name,
      nutrition: deps.cofid.toCanonicalProduct(food).nutrition ?? {},
    }));
  }
  return [];
}

/** Manifest of every known pack, with real item counts and availability — never fabricated. */
export function getPackManifest(deps: PackSyncDeps): PackManifestEntry[] {
  return PACK_REGISTRY.map((def) => ({
    ...def,
    itemCount: itemCountFor(def.packId, deps),
    available: isAvailableFor(def.packId, deps),
  }));
}

/**
 * Sync one pack against a client's cached `clientVersion`. Returns an empty, `upToDate: true`
 * result both when the client is current AND when the dataset isn't available server-side —
 * the caller cannot distinguish "nothing changed" from "no data exists" from the result shape
 * alone, so route handlers should surface `available` (from the manifest) separately if that
 * distinction matters to the UI.
 */
export function syncPack(packId: string, clientVersion: string | undefined, deps: PackSyncDeps): PackSyncResult {
  const def = getPackDefinition(packId);
  if (!def) throw new PackNotFoundError(packId);

  if (!isAvailableFor(packId, deps) || clientVersion === def.datasetVersion) {
    return { packId, datasetVersion: def.datasetVersion, items: [], upToDate: true };
  }

  return { packId, datasetVersion: def.datasetVersion, items: itemsFor(packId, deps), upToDate: false };
}
