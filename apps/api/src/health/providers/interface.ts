// HealthDataProvider interface — every platform adapter implements this.
// Dedup is handled by the caller via health_metrics(user_id, external_id) unique constraint.

import type { HealthMetric, MetricType, SyncAnchor } from '../types.js';

export interface SyncResult {
  ingested:     number;
  skipped:      number;  // already present (dedup)
  errors:       number;
  nextAnchor?:  SyncAnchor;
}

export interface HealthDataProvider {
  readonly name: string;  // 'fitbit' | 'garmin'

  /** Full incremental sync for a user; respects existing anchor. */
  sync(
    userId:      string,
    accessToken: string,
    anchor:      SyncAnchor | null,
    metricTypes: MetricType[],
  ): Promise<SyncResult>;

  /** Refresh OAuth token; returns new tokens. */
  refreshToken(
    userId:        string,
    refreshToken:  string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>;
}
