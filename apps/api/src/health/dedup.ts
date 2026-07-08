// Health metric deduplication — idempotent upsert via external_id.
// Overlap resolution: same event from multiple sources (e.g. same workout
// appearing in both HealthKit and Health Connect) → one wins via ON CONFLICT DO NOTHING.
// The first platform to write wins; subsequent duplicate external_ids are silently skipped.
//
// Overlap detection for workouts without identical external IDs:
// Two workout metrics from different platforms are considered duplicates if:
//   - Same user
//   - Same metric_type = 'workout'
//   - Time overlap ≥ 80% of the shorter session
// This case is documented but rare; our external_id convention is
// `${platform}:${type}:${session_id}` which is platform-scoped so there is
// no conflict on UNIQUE(user_id, external_id) — overlap resolution requires
// explicit query (see detectOverlappingWorkouts()).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HealthMetric } from './types.js';

export interface UpsertResult {
  ingested: number;
  skipped:  number;
}

/** Batch upsert health metrics; skips duplicates via external_id uniqueness. */
export async function upsertHealthMetrics(
  metrics:  HealthMetric[],
  supabase: SupabaseClient,
): Promise<UpsertResult> {
  if (metrics.length === 0) return { ingested: 0, skipped: 0 };

  const rows = metrics.map((m) => ({
    user_id:         m.userId,
    metric_type:     m.metricType,
    value:           m.value,
    unit:            m.unit,
    start_time:      m.startTime.toISOString(),
    end_time:        m.endTime?.toISOString() ?? null,
    source_platform: m.sourcePlatform,
    source_device:   m.sourceDevice ?? null,
    external_id:     m.externalId,
    sync_batch:      m.syncBatch ?? null,
  }));

  // ON CONFLICT DO NOTHING — idempotent; duplicates are silently skipped
  const { data, error } = await supabase
    .from('health_metrics')
    .upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
    .select('id');

  if (error) throw new Error(`upsertHealthMetrics: ${error.message}`);

  const ingested = data?.length ?? 0;
  return { ingested, skipped: metrics.length - ingested };
}

/**
 * Detect overlapping workout sessions across different source platforms.
 * Returns pairs of (metric_id_a, metric_id_b) that likely represent the
 * same workout recorded by two different devices/apps.
 * Overlap threshold: ≥ 80% temporal overlap of the shorter session.
 */
export async function detectOverlappingWorkouts(
  userId:   string,
  supabase: SupabaseClient,
): Promise<Array<{ idA: string; idB: string; overlapPct: number }>> {
  const { data: workouts } = await supabase
    .from('health_metrics')
    .select('id, source_platform, start_time, end_time')
    .eq('user_id', userId)
    .eq('metric_type', 'workout')
    .order('start_time', { ascending: true });

  if (!workouts || workouts.length < 2) return [];

  const overlaps: Array<{ idA: string; idB: string; overlapPct: number }> = [];
  const OVERLAP_THRESHOLD = 0.8;

  for (let i = 0; i < workouts.length; i++) {
    for (let j = i + 1; j < workouts.length; j++) {
      const a = workouts[i]!;
      const b = workouts[j]!;

      // Skip same platform (already deduped by external_id)
      if (a.source_platform === b.source_platform) continue;

      const aStart = new Date(a.start_time as string).getTime();
      const aEnd   = a.end_time ? new Date(a.end_time as string).getTime() : aStart + 60_000;
      const bStart = new Date(b.start_time as string).getTime();
      const bEnd   = b.end_time ? new Date(b.end_time as string).getTime() : bStart + 60_000;

      const overlapMs = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
      const shorterMs = Math.min(aEnd - aStart, bEnd - bStart);
      if (shorterMs <= 0) continue;

      const overlapPct = overlapMs / shorterMs;
      if (overlapPct >= OVERLAP_THRESHOLD) {
        overlaps.push({ idA: a.id as string, idB: b.id as string, overlapPct });
      }
    }
  }

  return overlaps;
}
