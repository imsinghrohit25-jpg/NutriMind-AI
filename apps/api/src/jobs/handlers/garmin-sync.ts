// pg-boss job handler: garmin-sync
// Mirrors fitbit-sync.ts pattern for Garmin Health API.

import type { SupabaseClient } from '@supabase/supabase-js';
import { GarminProvider } from '../../health/providers/garmin.js';
import { grantedMetricTypes } from '../../health/consent.js';
import type { SyncAnchor } from '../../health/types.js';

export interface GarminSyncJobData {
  userId: string;
}

export async function runGarminSyncJob(
  data:     GarminSyncJobData,
  supabase: SupabaseClient,
): Promise<void> {
  const { userId } = data;

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'garmin')
    .single();

  if (tokenErr || !tokenRow) {
    console.log(`[garmin-sync] No Garmin token for ${userId}`);
    return;
  }

  const provider = new GarminProvider(supabase);
  let accessToken = tokenRow.access_token as string;

  if (tokenRow.expires_at && new Date(tokenRow.expires_at as string) < new Date()) {
    try {
      const refreshed = await provider.refreshToken(userId, tokenRow.refresh_token as string);
      accessToken = refreshed.accessToken;
      await supabase.from('oauth_tokens').update({
        access_token:  refreshed.accessToken,
        refresh_token: refreshed.refreshToken ?? tokenRow.refresh_token,
        expires_at:    refreshed.expiresAt?.toISOString(),
        updated_at:    new Date().toISOString(),
      }).eq('user_id', userId).eq('provider', 'garmin');
    } catch (err) {
      console.error(`[garmin-sync] Token refresh failed:`, err);
      return;
    }
  }

  const metricTypes = await grantedMetricTypes(userId, supabase);
  if (metricTypes.length === 0) return;

  const { data: anchorRow } = await supabase
    .from('sync_anchors')
    .select('last_sync_at, anchor_value')
    .eq('user_id', userId)
    .eq('source_platform', 'garmin')
    .single();

  const anchor: SyncAnchor | null = anchorRow
    ? {
        userId,
        sourcePlatform: 'garmin',
        lastSyncAt:  new Date(anchorRow.last_sync_at as string),
        anchorValue: anchorRow.anchor_value as string | undefined,
      }
    : null;

  const result = await provider.sync(userId, accessToken, anchor, metricTypes);

  if (result.nextAnchor) {
    await supabase.from('sync_anchors').upsert({
      user_id:         userId,
      source_platform: 'garmin',
      last_sync_at:    result.nextAnchor.lastSyncAt.toISOString(),
      anchor_value:    result.nextAnchor.anchorValue,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,source_platform' });
  }

  console.log(`[garmin-sync] ${userId}: ingested=${result.ingested} errors=${result.errors}`);
}
