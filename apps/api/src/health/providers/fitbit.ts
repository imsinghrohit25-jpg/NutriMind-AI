// Fitbit Web API cloud connector.
// OAuth 2.0 Authorization Code with PKCE.
// Rate limit: 150 requests per hour per user (documented in Fitbit API).
// Credential requirement: FITBIT_CLIENT_ID + FITBIT_CLIENT_SECRET in .env
// (Fitbit App registration: https://dev.fitbit.com/apps/new)

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HealthDataProvider, SyncResult } from './interface.js';
import type { HealthMetric, MetricType, SyncAnchor } from '../types.js';
import { upsertHealthMetrics } from '../dedup.js';

const FITBIT_API_BASE = 'https://api.fitbit.com/1';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
export const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';

export const FITBIT_SCOPES = [
  'activity',
  'heartrate',
  'sleep',
  'weight',
] as const;

// Fitbit rate: 150 req/hour — we add jitter between requests
const REQUEST_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fitbitGet(
  path:        string,
  accessToken: string,
): Promise<unknown> {
  const resp = await fetch(`${FITBIT_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (resp.status === 429) throw new Error('Fitbit rate limit exceeded');
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Fitbit API ${resp.status}: ${body}`);
  }
  return resp.json();
}

function dateRange(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}

async function fetchSteps(
  date:        string,
  accessToken: string,
  userId:      string,
): Promise<HealthMetric[]> {
  const data = await fitbitGet(
    `/user/-/activities/steps/date/${date}/1d.json`,
    accessToken,
  ) as { 'activities-steps': Array<{ dateTime: string; value: string }> };

  return (data['activities-steps'] ?? [])
    .filter((r) => parseInt(r.value, 10) > 0)
    .map((r) => ({
      userId,
      metricType:     'steps' as const,
      value:          parseInt(r.value, 10),
      unit:           'count',
      startTime:      parseDate(r.dateTime),
      endTime:        parseDate(r.dateTime),
      sourcePlatform: 'fitbit' as const,
      externalId:     `fitbit:steps:${r.dateTime}`,
    }));
}

async function fetchActiveEnergy(
  date:        string,
  accessToken: string,
  userId:      string,
): Promise<HealthMetric[]> {
  const data = await fitbitGet(
    `/user/-/activities/calories/date/${date}/1d.json`,
    accessToken,
  ) as { 'activities-calories': Array<{ dateTime: string; value: string }> };

  return (data['activities-calories'] ?? [])
    .filter((r) => parseFloat(r.value) > 0)
    .map((r) => ({
      userId,
      metricType:     'active_energy' as const,
      value:          Math.round(parseFloat(r.value)),
      unit:           'kcal',
      startTime:      parseDate(r.dateTime),
      endTime:        parseDate(r.dateTime),
      sourcePlatform: 'fitbit' as const,
      externalId:     `fitbit:active_energy:${r.dateTime}`,
    }));
}

async function fetchSleep(
  date:        string,
  accessToken: string,
  userId:      string,
): Promise<HealthMetric[]> {
  const data = await fitbitGet(
    `/user/-/sleep/date/${date}.json`,
    accessToken,
  ) as { summary?: { totalMinutesAsleep?: number }; sleep: Array<{ logId: number; minutesAsleep: number; startTime: string; endTime: string }> };

  return (data.sleep ?? [])
    .filter((s) => s.minutesAsleep > 0)
    .map((s) => ({
      userId,
      metricType:     'sleep_duration' as const,
      value:          s.minutesAsleep,
      unit:           'minutes',
      startTime:      new Date(s.startTime),
      endTime:        new Date(s.endTime),
      sourcePlatform: 'fitbit' as const,
      externalId:     `fitbit:sleep:${s.logId}`,
    }));
}

async function fetchHeartRate(
  date:        string,
  accessToken: string,
  userId:      string,
): Promise<HealthMetric[]> {
  const data = await fitbitGet(
    `/user/-/activities/heart/date/${date}/1d.json`,
    accessToken,
  ) as { 'activities-heart': Array<{ dateTime: string; value: { restingHeartRate?: number } }> };

  return (data['activities-heart'] ?? [])
    .filter((r) => r.value?.restingHeartRate != null)
    .map((r) => ({
      userId,
      metricType:     'heart_rate' as const,
      value:          r.value.restingHeartRate!,
      unit:           'bpm',
      startTime:      parseDate(r.dateTime),
      sourcePlatform: 'fitbit' as const,
      externalId:     `fitbit:resting_hr:${r.dateTime}`,
    }));
}

async function fetchWeight(
  date:        string,
  accessToken: string,
  userId:      string,
): Promise<HealthMetric[]> {
  const data = await fitbitGet(
    `/user/-/body/log/weight/date/${date}.json`,
    accessToken,
  ) as { weight: Array<{ logId: number; weight: number; date: string }> };

  return (data.weight ?? []).map((w) => ({
    userId,
    metricType:     'weight' as const,
    value:          w.weight,
    unit:           'kg',
    startTime:      parseDate(w.date),
    sourcePlatform: 'fitbit' as const,
    externalId:     `fitbit:weight:${w.logId}`,
  }));
}

export class FitbitProvider implements HealthDataProvider {
  readonly name = 'fitbit';

  constructor(private readonly supabase: SupabaseClient) {}

  async sync(
    userId:      string,
    accessToken: string,
    anchor:      SyncAnchor | null,
    metricTypes: MetricType[],
  ): Promise<SyncResult> {
    const from = anchor?.lastSyncAt
      ? new Date(anchor.lastSyncAt.getTime() - 24 * 60 * 60 * 1000) // 1-day overlap
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);  // default: 30 days back
    const to = new Date();
    const dates = dateRange(from, to);

    let ingested = 0;
    let errors   = 0;

    const TYPE_FETCHERS: Partial<Record<MetricType, (d: string) => Promise<HealthMetric[]>>> = {
      steps:          (d) => fetchSteps(d, accessToken, userId),
      active_energy:  (d) => fetchActiveEnergy(d, accessToken, userId),
      sleep_duration: (d) => fetchSleep(d, accessToken, userId),
      heart_rate:     (d) => fetchHeartRate(d, accessToken, userId),
      weight:         (d) => fetchWeight(d, accessToken, userId),
    };

    for (const date of dates) {
      for (const type of metricTypes) {
        const fetcher = TYPE_FETCHERS[type];
        if (!fetcher) continue;
        try {
          const metrics = await fetcher(date);
          if (metrics.length > 0) {
            const result = await upsertHealthMetrics(metrics, this.supabase);
            ingested += result.ingested;
          }
          await sleep(REQUEST_DELAY_MS);
        } catch (err) {
          console.error(`[fitbit] ${type} ${date}:`, String(err));
          errors++;
        }
      }
    }

    return {
      ingested,
      skipped: 0,
      errors,
      nextAnchor: {
        userId,
        sourcePlatform: 'fitbit',
        lastSyncAt:     to,
        anchorValue:    to.toISOString(),
      },
    };
  }

  async refreshToken(
    _userId:       string,
    refreshToken:  string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    const clientId     = process.env['FITBIT_CLIENT_ID'];
    const clientSecret = process.env['FITBIT_CLIENT_SECRET'];

    if (!clientId || !clientSecret) {
      throw new Error('FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET not configured');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const resp = await fetch(FITBIT_TOKEN_URL, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Fitbit token refresh ${resp.status}: ${body}`);
    }

    const json = await resp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken:  json.access_token,
      refreshToken: json.refresh_token,
      expiresAt:    json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000)
        : undefined,
    };
  }
}

/** Build the Fitbit OAuth authorization URL (used by the mobile OAuth flow). */
export function buildFitbitAuthUrl(
  redirectUri: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    client_id:              process.env['FITBIT_CLIENT_ID'] ?? '',
    response_type:          'code',
    scope:                  FITBIT_SCOPES.join(' '),
    redirect_uri:           redirectUri,
    code_challenge:         codeChallenge,
    code_challenge_method:  'S256',
  });
  return `${FITBIT_AUTH_URL}?${params.toString()}`;
}

/** Exchange code for tokens (PKCE flow). */
export async function exchangeFitbitCode(
  code:        string,
  redirectUri: string,
  codeVerifier:string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; providerUserId: string }> {
  const clientId     = process.env['FITBIT_CLIENT_ID'];
  const clientSecret = process.env['FITBIT_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('Fitbit credentials not configured');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const resp = await fetch(FITBIT_TOKEN_URL, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      grant_type:    'authorization_code',
      redirect_uri:  redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Fitbit code exchange ${resp.status}: ${body}`);
  }

  const json = await resp.json() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
    user_id:       string;
  };

  return {
    accessToken:    json.access_token,
    refreshToken:   json.refresh_token,
    expiresAt:      new Date(Date.now() + json.expires_in * 1000),
    providerUserId: json.user_id,
  };
}
