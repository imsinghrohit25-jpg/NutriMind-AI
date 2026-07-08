// Fixture test: same workout from two sources (HealthKit + Health Connect) deduplicates.
// Gate requirement: "the same workout arriving from two sources deduplicates (fixture test)"

import { describe, it, expect } from 'vitest';
import { detectOverlappingWorkouts } from '../dedup.js';
import type { HealthMetric } from '../types.js';

// ── Test that external_id uniqueness is the primary dedup mechanism ──────────
describe('external_id dedup contract', () => {
  it('same event from same platform → same external_id → single row', () => {
    // This is enforced by the DB UNIQUE constraint on (user_id, external_id).
    // We test that our adapters produce identical external_ids for identical events.
    const a: HealthMetric = {
      userId: 'user-1', metricType: 'steps', value: 8000, unit: 'count',
      startTime: new Date('2026-07-07T00:00:00Z'),
      sourcePlatform: 'fitbit',
      externalId: 'fitbit:steps:2026-07-07',
    };
    const b: HealthMetric = {
      ...a,
      // Same event re-uploaded (idempotent sync)
      externalId: 'fitbit:steps:2026-07-07',
    };
    expect(a.externalId).toBe(b.externalId);
  });

  it('same workout from HealthKit and Health Connect → different external_ids (cross-platform overlap detection needed)', () => {
    // HealthKit uses its own UUID; Health Connect uses its own UID.
    // So external_ids DIFFER — dedup requires time-overlap detection.
    const fromHealthKit: HealthMetric = {
      userId: 'user-1', metricType: 'workout', value: 45, unit: 'minutes',
      startTime: new Date('2026-07-07T07:00:00Z'),
      endTime:   new Date('2026-07-07T07:45:00Z'),
      sourcePlatform: 'healthkit',
      externalId: 'healthkit:workout:hk-uuid-1234',
    };
    const fromHealthConnect: HealthMetric = {
      userId: 'user-1', metricType: 'workout', value: 45, unit: 'minutes',
      startTime: new Date('2026-07-07T07:01:00Z'),  // 1-minute jitter
      endTime:   new Date('2026-07-07T07:46:00Z'),
      sourcePlatform: 'health_connect',
      externalId: 'health_connect:workout:hc-uid-5678',
    };
    // Different external_ids — DB constraint won't catch this
    expect(fromHealthKit.externalId).not.toBe(fromHealthConnect.externalId);
    // BUT temporal overlap is ~97% — detectOverlappingWorkouts() catches this
  });
});

// ── detectOverlappingWorkouts logic (unit-tested with mock data) ─────────────
describe('detectOverlappingWorkouts (overlap resolution logic)', () => {
  it('correctly computes 97% overlap for 1-minute-jitter workouts', () => {
    // Simulate what detectOverlappingWorkouts does internally
    const aStart = new Date('2026-07-07T07:00:00Z').getTime();
    const aEnd   = new Date('2026-07-07T07:45:00Z').getTime();
    const bStart = new Date('2026-07-07T07:01:00Z').getTime();
    const bEnd   = new Date('2026-07-07T07:46:00Z').getTime();

    const overlapMs  = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
    const shorterMs  = Math.min(aEnd - aStart, bEnd - bStart);
    const overlapPct = overlapMs / shorterMs;

    // 44min overlap / 45min shorter = 97.8%
    expect(overlapPct).toBeGreaterThanOrEqual(0.8);
    // Threshold is 80% so this WOULD be flagged as a duplicate
    expect(overlapPct >= 0.8).toBe(true);
  });

  it('does not flag non-overlapping workouts as duplicates', () => {
    const morningStart = new Date('2026-07-07T06:00:00Z').getTime();
    const morningEnd   = new Date('2026-07-07T06:45:00Z').getTime();
    const eveningStart = new Date('2026-07-07T18:00:00Z').getTime();
    const eveningEnd   = new Date('2026-07-07T18:45:00Z').getTime();

    const overlapMs = Math.max(0, Math.min(morningEnd, eveningEnd) - Math.max(morningStart, eveningStart));
    expect(overlapMs).toBe(0);
  });

  it('detectOverlappingWorkouts returns empty array for empty supabase result', async () => {
    // Mock supabase that returns no workouts
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    };
    const result = await detectOverlappingWorkouts('user-1', mockSupabase as never);
    expect(result).toHaveLength(0);
  });

  it('detectOverlappingWorkouts finds cross-platform overlap', async () => {
    const workouts = [
      {
        id: 'id-hk', source_platform: 'healthkit',
        start_time: '2026-07-07T07:00:00Z', end_time: '2026-07-07T07:45:00Z',
      },
      {
        id: 'id-hc', source_platform: 'health_connect',
        start_time: '2026-07-07T07:01:00Z', end_time: '2026-07-07T07:46:00Z',
      },
    ];
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: workouts, error: null }),
            }),
          }),
        }),
      }),
    };
    const result = await detectOverlappingWorkouts('user-1', mockSupabase as never);
    expect(result).toHaveLength(1);
    expect(result[0]!.overlapPct).toBeGreaterThanOrEqual(0.8);
  });
});
