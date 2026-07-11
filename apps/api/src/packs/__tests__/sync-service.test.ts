import { describe, it, expect, vi } from 'vitest';
import { getPackManifest, syncPack } from '../sync-service.js';
import { PackNotFoundError } from '../types.js';
import type { PackSyncDeps } from '../sync-service.js';

const IFCT_ENTRY = { foodCode: 'A001', foodNameEn: 'Masoor Dal' };
const COFID_FOOD = { sourceId: 'UK001', name: 'Cheddar Cheese' };

function makeDeps(opts: { ifctAvailable?: boolean; cofidAvailable?: boolean } = {}): PackSyncDeps {
  const ifctAvailable = opts.ifctAvailable ?? true;
  const cofidAvailable = opts.cofidAvailable ?? true;
  return {
    ifct: {
      isAvailable: () => ifctAvailable,
      count: ifctAvailable ? 1 : 0,
      getAll: () => (ifctAvailable ? [IFCT_ENTRY] : []),
      toCanonicalProduct: vi.fn().mockReturnValue({ nutrition: { energyKcal: 343 } }),
    } as unknown as PackSyncDeps['ifct'],
    cofid: {
      isAvailable: () => cofidAvailable,
      size: cofidAvailable ? 1 : 0,
      getAll: () => (cofidAvailable ? [COFID_FOOD] : []),
      toCanonicalProduct: vi.fn().mockReturnValue({ nutrition: { energyKcal: 403 } }),
    } as unknown as PackSyncDeps['cofid'],
  };
}

describe('getPackManifest', () => {
  it('reports real item counts and availability when datasets are loaded', () => {
    const manifest = getPackManifest(makeDeps());
    const ifctPack = manifest.find((p) => p.packId === 'ifct_in_2017')!;
    expect(ifctPack.available).toBe(true);
    expect(ifctPack.itemCount).toBe(1);
  });

  it('never fabricates availability or item count when a dataset is not loaded', () => {
    const manifest = getPackManifest(makeDeps({ ifctAvailable: false, cofidAvailable: false }));
    for (const pack of manifest) {
      expect(pack.available).toBe(false);
      expect(pack.itemCount).toBe(0);
    }
  });

  it('lists every registered pack (currently IFCT + CoFID, not USDA)', () => {
    const manifest = getPackManifest(makeDeps());
    expect(manifest.map((p) => p.packId).sort()).toEqual(['cofid_gb_2021', 'ifct_in_2017']);
  });
});

describe('syncPack', () => {
  it('throws PackNotFoundError for an unknown packId', () => {
    expect(() => syncPack('does_not_exist', undefined, makeDeps())).toThrow(PackNotFoundError);
  });

  it('returns the full snapshot when the client has no cached version', () => {
    const result = syncPack('ifct_in_2017', undefined, makeDeps());
    expect(result.upToDate).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.sourceId).toBe('A001');
  });

  it('returns an empty, up-to-date diff when the client version matches the current version', () => {
    const result = syncPack('ifct_in_2017', '2017', makeDeps());
    expect(result.upToDate).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it('returns the full snapshot again when the client version is stale', () => {
    const result = syncPack('ifct_in_2017', '2016', makeDeps());
    expect(result.upToDate).toBe(false);
    expect(result.items).toHaveLength(1);
  });

  it('gracefully returns an empty, up-to-date result when the dataset is not available — never throws, never fabricates data', () => {
    const result = syncPack('ifct_in_2017', undefined, makeDeps({ ifctAvailable: false }));
    expect(result.upToDate).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it('works independently for the CoFID pack', () => {
    const result = syncPack('cofid_gb_2021', undefined, makeDeps());
    expect(result.items[0]!.sourceId).toBe('UK001');
    expect(result.datasetVersion).toBe('2021');
  });
});
