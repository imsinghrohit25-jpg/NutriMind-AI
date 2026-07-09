import { describe, it, expect } from 'vitest';
import { GatewayBackpressure, GatewayOverloadedError } from '../backpressure.js';

describe('GatewayBackpressure', () => {
  it('allows requests within per-user capacity', () => {
    const bp = new GatewayBackpressure(2, 1, 50);
    const s1 = bp.acquire('user-1');
    const s2 = bp.acquire('user-1');
    expect(bp.currentInFlight).toBe(2);
    s1.release();
    s2.release();
    expect(bp.currentInFlight).toBe(0);
  });

  it('rejects a user who has exhausted their token bucket', () => {
    const bp = new GatewayBackpressure(1, 0, 50); // capacity 1, no refill
    bp.acquire('user-1');
    expect(() => bp.acquire('user-1')).toThrow(GatewayOverloadedError);
  });

  it('does not let one user starve another', () => {
    const bp = new GatewayBackpressure(1, 0, 50);
    bp.acquire('user-1');
    expect(() => bp.acquire('user-2')).not.toThrow();
  });

  it('rejects once global concurrency is exhausted regardless of per-user capacity', () => {
    const bp = new GatewayBackpressure(10, 10, 1);
    bp.acquire('user-1');
    expect(() => bp.acquire('user-2')).toThrow(GatewayOverloadedError);
  });

  it('release is idempotent and frees a global slot', () => {
    const bp = new GatewayBackpressure(10, 10, 1);
    const slot = bp.acquire('user-1');
    slot.release();
    slot.release(); // must not double-decrement
    expect(bp.currentInFlight).toBe(0);
    expect(() => bp.acquire('user-2')).not.toThrow();
  });

  it('skips the per-user bucket entirely when no userId is given', () => {
    const bp = new GatewayBackpressure(0, 0, 50);
    expect(() => bp.acquire(undefined)).not.toThrow();
  });
});
