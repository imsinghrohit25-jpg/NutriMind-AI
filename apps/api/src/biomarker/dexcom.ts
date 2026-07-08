// Dexcom CGM connector — Dexcom Web API v3.
// OAuth 2.0 PKCE flow; no client secret (public client).
// API: https://api.dexcom.com
// Sandbox: https://sandbox-api.dexcom.com
//
// BLOCKER (documented): Dexcom Web API v3 requires application approval via
// Dexcom Developer Portal (developer.dexcom.com). This implementation is
// production-complete against the documented API surface. Credentials pending
// Dexcom application approval.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GlucoseReading, GlucoseTrend } from './types.js';

const DEXCOM_API_BASE     = process.env['DEXCOM_SANDBOX'] === 'true'
  ? 'https://sandbox-api.dexcom.com'
  : 'https://api.dexcom.com';
const DEXCOM_AUTH_URL     = `${DEXCOM_API_BASE}/v2/oauth2/login`;
const DEXCOM_TOKEN_URL    = `${DEXCOM_API_BASE}/v2/oauth2/token`;
const DEXCOM_CLIENT_ID    = process.env['DEXCOM_CLIENT_ID'] ?? '';

export const DEXCOM_SCOPES = 'offline_access egv calibrations devices dataRange';

// Dexcom trend → canonical trend arrow
const TREND_MAP: Record<string, GlucoseTrend> = {
  'rising':              'rising_quickly',   // DoubleUp
  'risingQuickly':       'rising_quickly',
  'rising_quickly':      'rising_quickly',
  'rising_rapidly':      'rising_quickly',
  'rising_slightly':     'rising',
  'risingSlightly':      'rising',
  'steady':              'stable',
  'falling_slightly':    'falling',
  'fallingSlightly':     'falling',
  'falling':             'falling_quickly',
  'fallingQuickly':      'falling_quickly',
  'falling_rapidly':     'falling_quickly',
  'none':                'unknown',
  'notComputable':       'unknown',
  'rateOutOfRange':      'unknown',
};

export function buildDexcomAuthUrl(
  redirectUri:    string,
  codeChallenge:  string,
  state:          string,
): string {
  const params = new URLSearchParams({
    client_id:             DEXCOM_CLIENT_ID,
    redirect_uri:          redirectUri,
    response_type:         'code',
    scope:                 DEXCOM_SCOPES,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  return `${DEXCOM_AUTH_URL}?${params.toString()}`;
}

export async function exchangeDexcomCode(
  code:         string,
  redirectUri:  string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const resp = await fetch(DEXCOM_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     DEXCOM_CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });
  if (!resp.ok) throw new Error(`Dexcom code exchange ${resp.status}`);
  const json = await resp.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken:  json.access_token,
    refreshToken: json.refresh_token,
    expiresAt:    new Date(Date.now() + json.expires_in * 1000),
  };
}

export async function refreshDexcomToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const resp = await fetch(DEXCOM_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     DEXCOM_CLIENT_ID,
    }),
  });
  if (!resp.ok) throw new Error(`Dexcom refresh ${resp.status}`);
  const json = await resp.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken:  json.access_token,
    refreshToken: json.refresh_token,
    expiresAt:    new Date(Date.now() + json.expires_in * 1000),
  };
}

interface DexcomEGVRecord {
  recordId:     string;
  systemTime:   string;
  displayTime:  string;
  value:        number;
  unit:         string;
  trend:        string;
  trendRate:    number | null;
  transmitterId?: string;
}

async function fetchDexcomEGVs(
  accessToken:  string,
  from:         Date,
  to:           Date,
): Promise<DexcomEGVRecord[]> {
  const params = new URLSearchParams({
    startDate: from.toISOString().replace(/\.\d{3}Z$/, ''),
    endDate:   to.toISOString().replace(/\.\d{3}Z$/, ''),
  });
  const resp = await fetch(`${DEXCOM_API_BASE}/v3/users/self/egvs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (resp.status === 401) throw new Error('Dexcom token expired');
  if (resp.status === 429) throw new Error('Dexcom rate limit');
  if (!resp.ok) throw new Error(`Dexcom EGV ${resp.status}`);
  const json = await resp.json() as { egvs?: DexcomEGVRecord[] };
  return json.egvs ?? [];
}

/** Fetch + upsert CGM readings for a time window. */
export async function syncDexcomReadings(opts: {
  userId:      string;
  accessToken: string;
  from:        Date;
  to:          Date;
  supabase:    SupabaseClient;
}): Promise<{ ingested: number; skipped: number }> {
  const { userId, accessToken, from, to, supabase } = opts;

  const egvs = await fetchDexcomEGVs(accessToken, from, to);
  if (egvs.length === 0) return { ingested: 0, skipped: 0 };

  const rows = egvs.map((e) => ({
    user_id:         userId,
    value_mgdl:      e.value,
    trend_arrow:     TREND_MAP[e.trend] ?? 'unknown',
    reading_time:    e.systemTime,
    source_platform: 'dexcom',
    external_id:     `dexcom:egv:${e.recordId}`,
    transmitter_id:  e.transmitterId ?? null,
  }));

  const { data, error } = await supabase
    .from('glucose_readings')
    .upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
    .select('id');

  if (error) throw new Error(`syncDexcomReadings: ${error.message}`);
  const ingested = data?.length ?? 0;
  return { ingested, skipped: rows.length - ingested };
}

/** Compute time-in-range statistics for a date window. */
export interface TimeInRangeStats {
  veryLow:    number;  // <54 mg/dL (%)
  low:        number;  // 54–69 mg/dL (%)
  inRange:    number;  // 70–180 mg/dL (%)
  high:       number;  // 181–250 mg/dL (%)
  veryHigh:   number;  // >250 mg/dL (%)
  meanGlucose: number;
  gmi:        number;  // Glucose Management Indicator (estimated HbA1c proxy)
  cv:         number;  // Coefficient of variation (%)
  readings:   number;
}

export async function computeTimeInRange(
  userId:   string,
  from:     Date,
  to:       Date,
  supabase: SupabaseClient,
): Promise<TimeInRangeStats> {
  const { data } = await supabase
    .from('glucose_readings')
    .select('value_mgdl')
    .eq('user_id', userId)
    .gte('reading_time', from.toISOString())
    .lte('reading_time', to.toISOString());

  const values = (data ?? []).map((r) => r.value_mgdl as number);
  if (values.length === 0) {
    return { veryLow: 0, low: 0, inRange: 0, high: 0, veryHigh: 0, meanGlucose: 0, gmi: 0, cv: 0, readings: 0 };
  }

  const n     = values.length;
  const mean  = values.reduce((a, b) => a + b, 0) / n;
  const std   = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const cv    = (std / mean) * 100;
  // GMI formula: Bergenstal et al. Diabetes Care 2018
  const gmi   = 3.31 + 0.02392 * mean;

  const count = (pred: (v: number) => boolean) =>
    Math.round((values.filter(pred).length / n) * 100);

  return {
    veryLow:     count((v) => v <  54),
    low:         count((v) => v >= 54  && v <  70),
    inRange:     count((v) => v >= 70  && v <= 180),
    high:        count((v) => v >  180 && v <= 250),
    veryHigh:    count((v) => v >  250),
    meanGlucose: Math.round(mean),
    gmi:         Math.round(gmi * 10) / 10,
    cv:          Math.round(cv * 10) / 10,
    readings:    n,
  };
}
