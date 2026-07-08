import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdgeCache } from '../edge-cache.js';

describe('EdgeCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined on a miss', () => {
    const cache = new EdgeCache<string>();
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.stats.misses).toBe(1);
  });

  it('returns the value on a hit', () => {
    const cache = new EdgeCache<string>();
    cache.set('barcode-1', 'product-a');
    expect(cache.get('barcode-1')).toBe('product-a');
    expect(cache.stats.hits).toBe(1);
  });

  it('expires entries after the TTL', () => {
    const cache = new EdgeCache<string>(1000);
    cache.set('barcode-1', 'product-a');
    vi.advanceTimersByTime(1001);
    expect(cache.get('barcode-1')).toBeUndefined();
  });

  it('does not expire entries before the TTL', () => {
    const cache = new EdgeCache<string>(1000);
    cache.set('barcode-1', 'product-a');
    vi.advanceTimersByTime(999);
    expect(cache.get('barcode-1')).toBe('product-a');
  });

  it('evicts the oldest entry once maxEntries is exceeded', () => {
    const cache = new EdgeCache<string>(60_000, 2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3'); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });

  it('overwriting an existing key does not evict', () => {
    const cache = new EdgeCache<string>(60_000, 2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('a', '1-updated');
    expect(cache.get('a')).toBe('1-updated');
    expect(cache.get('b')).toBe('2');
  });

  it('clear() resets entries and stats', () => {
    const cache = new EdgeCache<string>();
    cache.set('a', '1');
    cache.get('a');
    cache.get('missing');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.stats).toEqual({ hits: 0, misses: 0, size: 0 });
  });

  it('tracks size correctly', () => {
    const cache = new EdgeCache<string>();
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.size).toBe(2);
  });
});
