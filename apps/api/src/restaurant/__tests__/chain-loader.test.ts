import { describe, it, expect } from 'vitest';
import { RestaurantChainLoader } from '../chain-loader.js';

describe('RestaurantChainLoader — graceful degradation (no dataset installed, ADR-0018)', () => {
  it('isAvailable() is false before load()', () => {
    const loader = new RestaurantChainLoader();
    expect(loader.isAvailable()).toBe(false);
  });

  it('load() does not throw when no dataset file is present', async () => {
    const loader = new RestaurantChainLoader();
    await expect(loader.load()).resolves.not.toThrow();
    expect(loader.isAvailable()).toBe(false);
  });

  it('findItem() returns null when no dataset is loaded', async () => {
    const loader = new RestaurantChainLoader();
    await loader.load();
    expect(loader.findItem('mcdonalds_us', 'Big Mac')).toBeNull();
  });

  it('chainsForCountry() returns an empty array when no dataset is loaded', async () => {
    const loader = new RestaurantChainLoader();
    await loader.load();
    expect(loader.chainsForCountry('US')).toEqual([]);
  });

  it('size is 0 when no dataset is loaded', () => {
    const loader = new RestaurantChainLoader();
    expect(loader.size).toBe(0);
  });
});
