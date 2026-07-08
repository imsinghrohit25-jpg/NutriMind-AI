// Unified health data types — canonical schema every platform adapter normalises into.

export type MetricType =
  | 'steps'
  | 'active_energy'
  | 'resting_energy'
  | 'heart_rate'
  | 'weight'
  | 'sleep_duration'
  | 'workout'
  | 'blood_glucose'
  | 'hrv'
  | 'oxygen_saturation';

export type SourcePlatform = 'healthkit' | 'health_connect' | 'fitbit' | 'garmin' | 'manual';

export interface HealthMetric {
  userId:         string;
  metricType:     MetricType;
  value:          number;
  unit:           string;
  startTime:      Date;
  endTime?:       Date;
  sourcePlatform: SourcePlatform;
  sourceDevice?:  string;
  externalId:     string;   // required — used for idempotent upsert / dedup
  syncBatch?:     string;
}

export interface ConsentRecord {
  userId:          string;
  metricType:      MetricType;
  granted:         boolean;
  consentVersion:  number;
  grantedAt?:      Date;
  revokedAt?:      Date;
}

export interface SyncAnchor {
  userId:         string;
  sourcePlatform: SourcePlatform;
  lastSyncAt:     Date;
  anchorValue?:   string;  // platform-specific cursor
}

export interface OAuthToken {
  userId:         string;
  provider:       'fitbit' | 'garmin';
  accessToken:    string;
  refreshToken?:  string;
  expiresAt?:     Date;
  scopes?:        string[];
  providerUserId?: string;
}
