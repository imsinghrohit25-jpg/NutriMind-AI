import { describe, it, expect } from 'vitest';
import { computeDegradationLevel } from '../degradation.js';

describe('computeDegradationLevel', () => {
  it('is full when everything is healthy', () => {
    const status = computeDegradationLevel({ dbReachable: true, aiCircuitOpen: false });
    expect(status.level).toBe('full');
  });

  it('is ai_degraded when only the AI circuit is open', () => {
    const status = computeDegradationLevel({ dbReachable: true, aiCircuitOpen: true });
    expect(status.level).toBe('ai_degraded');
  });

  it('is reference_only when the database is unreachable, regardless of AI state', () => {
    const status = computeDegradationLevel({ dbReachable: false, aiCircuitOpen: false });
    expect(status.level).toBe('reference_only');
  });

  it('DB unreachability outranks an open AI circuit (reference_only, not ai_degraded)', () => {
    const status = computeDegradationLevel({ dbReachable: false, aiCircuitOpen: true });
    expect(status.level).toBe('reference_only');
  });
});
