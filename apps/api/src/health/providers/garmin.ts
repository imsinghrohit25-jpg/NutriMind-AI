// Garmin Health API cloud connector.
// OAuth 2.0 Authorization Code flow.
// Credential requirement: GARMIN_CLIENT_ID + GARMIN_CLIENT_SECRET
// Requires Garmin Developer Program enrollment: https://developer.garmin.com/gc-developer-program/
//
// BLOCKER (documented): Production access to Garmin Health API requires approval
// from Garmin's partner program. This implementation is production-complete against
// the documented API surface; credentials are pending partnership approval.
// Garmin sandbox does not exist as a public developer sandbox (unlike Fitbit) —
// integration is verified against the documented API contract and fixture tests.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HealthDataProvider, SyncResult } from './interface.js';
import type { HealthMetric, MetricType, SyncAnchor } from '../types.js';
import { upsertHealthMetrics } from '../dedup.js';

const GARMIN_API_BASE  = 'https://healthapi.garmin.com/wellness-api/rest';
const GARMIN_AUTH_URL  = 'https://connect.garmin.com/oauth-service/oauth/authorize';
const GARMIN_TOKEN_URL = 'https://connect.garmin.com/oauth-service/oauth/token';

export const GARMIN_SCOPES = 'ACTIVITY_EXPORT DAILY_SUMMARY SLEEP HEART_RATE WEIGHT';

async function garminGet(
  path:        string,
  accessToken: string,
): Promise<unknown> {
  const resp = await fetch(`${GARMIN_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (resp.status === 429) throw new Error('Garmin rate limit exceeded');
  if (resp.status === 401) throw new Error('Garmin token expired');
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Garmin API ${resp.status}: ${body}`);
  }
  return resp.json();
}

function toUnixSec(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

// Garmin Daily Summary covers: steps, active calories, resting calories
async function fetchDailySummaries(
  from:        Date,
  to:          Date,
  accessToken: string,
  userId:      string,
): Promise<HealthMetric[]> {
  const data = await garminGet(
    `/dailies?startTime=${toUnixSec(from)}&endTime=${toUnixSec(to)}`,
    accessToken,
  ) as {
    dailies?: Array<{
      summaryId: string;
      calendarDate: string;
      steps?: number;
      activeKilocalories?: number;
      bmrKilocalories?: number;
    }>;
  };

  const metrics: HealthMetric[] = [];
  for (const d of data.dailies ?? []) {
    const day = new Date(d.calendarDate + 'T00:00:00Z');
    if (d.steps) {
      metrics.push({
        userId, metricType: 'steps', value: d.steps, unit: 'count',
        startTime: day, sourcePlatform: 'garmin',
        externalId: `garmin:steps:${d.summaryId}`,
      });
    }
    if (d.activeKilocalories) {
      metrics.push({
        userId, metricType: 'active_energy', value: d.activeKilocalories, unit: 'kcal',
        startTime: day, sourcePlatform: 'garmin',
        externalId: `garmin:active_energy:${d.summaryId}`,
      });
    }
    if (d.bmrKilocalories) {
      metrics.push({
        userId, metricType: 'resting_energy', value: d.bmrKilocalories, unit: 'kcal',
        startTime: day, sourcePlatform: 'garmin',
        externalId: `garmin:resting_energy:${d.summaryId}`,
      });
    }
  }
  return metrics;
}

async function fetchSleepData(
  from:        Date,
  to:          Date,
  accessToken: string,
  userId:      string,
): Promise<HealthMetric[]> {
  const data = await garminGet(
    `/sleep?startTime=${toUnixSec(from)}&endTime=${toUnixSec(to)}`,
    accessToken,
  ) as {
    sleeps?: Array<{
      summaryId: string;
      calendarDate: string;
      durationInSeconds?: number;
      startTimeInSeconds?: number;
      endTimeInSeconds?: number;
    }>;
  };

  return (data.sleeps ?? [])
    .filter((s) => (s.durationInSeconds ?? 0) > 0)
    .map((s) => ({
      userId,
      metricType:     'sleep_duration' as const,
      value:          Math.round((s.durationInSeconds ?? 0) / 60),
      unit:           'minutes',
      startTime:      s.startTimeInSeconds ? new Date(s.startTimeInSeconds * 1000) : new Date(s.calendarDate + 'T00:00:00Z'),
      endTime:        s.endTimeInSeconds ? new Date(s.endTimeInSeconds * 1000) : undefined,
      sourcePlatform: 'garmin' as const,
      externalId:     `garmin:sleep:${s.summaryId}`,
    }));
}

export class GarminProvider implements HealthDataProvider {
  readonly name = 'garmin';

  constructor(private readonly supabase: SupabaseClient) {}

  async sync(
    userId:      string,
    accessToken: string,
    anchor:      SyncAnchor | null,
    metricTypes: MetricType[],
  ): Promise<SyncResult> {
    const from = anchor?.lastSyncAt
      ? new Date(anchor.lastSyncAt.getTime() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = new Date();

    let ingested = 0;
    let errors   = 0;

    const wantsDailies = metricTypes.some((t) =>
      ['steps', 'active_energy', 'resting_energy'].includes(t),
    );
    const wantsSleep = metricTypes.includes('sleep_duration');

    try {
      if (wantsDailies) {
        const metrics = await fetchDailySummaries(from, to, accessToken, userId);
        if (metrics.length > 0) {
          const r = await upsertHealthMetrics(metrics, this.supabase);
          ingested += r.ingested;
        }
      }
    } catch (err) {
      console.error('[garmin] daily summaries:', String(err));
      errors++;
    }

    try {
      if (wantsSleep) {
        const metrics = await fetchSleepData(from, to, accessToken, userId);
        if (metrics.length > 0) {
          const r = await upsertHealthMetrics(metrics, this.supabase);
          ingested += r.ingested;
        }
      }
    } catch (err) {
      console.error('[garmin] sleep:', String(err));
      errors++;
    }

    return {
      ingested,
      skipped: 0,
      errors,
      nextAnchor: {
        userId,
        sourcePlatform: 'garmin',
        lastSyncAt:     to,
        anchorValue:    to.toISOString(),
      },
    };
  }

  async refreshToken(
    _userId:      string,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    const clientId     = process.env['GARMIN_CLIENT_ID'];
    const clientSecret = process.env['GARMIN_CLIENT_SECRET'];
    if (!clientId || !clientSecret) throw new Error('Garmin credentials not configured');

    const resp = await fetch(GARMIN_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    });

    if (!resp.ok) throw new Error(`Garmin refresh ${resp.status}`);
    const json = await resp.json() as {
      access_token: string; refresh_token?: string; expires_in?: number;
    };

    return {
      accessToken:  json.access_token,
      refreshToken: json.refresh_token,
      expiresAt:    json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
    };
  }
}

export function buildGarminAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id:    process.env['GARMIN_CLIENT_ID'] ?? '',
    redirect_uri: redirectUri,
    scope:        GARMIN_SCOPES,
    response_type:'code',
    state,
  });
  return `${GARMIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGarminCode(
  code:        string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const clientId     = process.env['GARMIN_CLIENT_ID'];
  const clientSecret = process.env['GARMIN_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('Garmin credentials not configured');

  const resp = await fetch(GARMIN_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) throw new Error(`Garmin code exchange ${resp.status}`);
  const json = await resp.json() as {
    access_token: string; refresh_token: string; expires_in: number;
  };

  return {
    accessToken:  json.access_token,
    refreshToken: json.refresh_token,
    expiresAt:    new Date(Date.now() + json.expires_in * 1000),
  };
}
