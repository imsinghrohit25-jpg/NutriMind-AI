// pg-boss job handler: fitbit-sync
// Runs server-side incremental sync for a user's Fitbit data.
// Registered in jobs/registry.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { FitbitProvider } from '../../health/providers/fitbit.js';
import { grantedMetricTypes } from '../../health/consent.js';
import type { SyncAnchor } from '../../health/types.js';

export interface FitbitSyncJobData {
  userId: string;
}

export async function runFitbitSyncJob(
  data:     FitbitSyncJobData,
  supabase: SupabaseClient,
): Promise<void> {
  const { userId } = data;

  // 1. Load OAuth token
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'fitbit')
    .single();

  if (tokenErr || !tokenRow) {
    console.log(`[fitbit-sync] No Fitbit token for ${userId}`);
    return;
  }

  const provider = new FitbitProvider(supabase);

  // 2. Refresh token if expired
  let accessToken = tokenRow.access_token as string;
  if (tokenRow.expires_at && new Date(tokenRow.expires_at as string) < new Date()) {
    try {
      const refreshed = await provider.refreshToken(userId, tokenRow.refresh_token as string);
      accessToken = refreshed.accessToken;
      await supabase.from('oauth_tokens').update({
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken ?? tokenRow.refresh_token,
        expires_at: refreshed.expiresAt?.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('provider', 'fitbit');
    } catch (err) {
      console.error(`[fitbit-sync] Token refresh failed for ${userId}:`, err);
      return;
    }
  }

  // 3. Load consented metric types
  const metricTypes = await grantedMetricTypes(userId, supabase);
  if (metricTypes.length === 0) {
    console.log(`[fitbit-sync] No consented metric types for ${userId}`);
    return;
  }

  // 4. Load sync anchor
  const { data: anchorRow } = await supabase
    .from('sync_anchors')
    .select('last_sync_at, anchor_value')
    .eq('user_id', userId)
    .eq('source_platform', 'fitbit')
    .single();

  const anchor: SyncAnchor | null = anchorRow
    ? {
        userId,
        sourcePlatform: 'fitbit',
        lastSyncAt: new Date(anchorRow.last_sync_at as string),
        anchorValue: anchorRow.anchor_value as string | undefined,
      }
    : null;

  // 5. Sync
  const result = await provider.sync(userId, accessToken, anchor, metricTypes);

  // 6. Update sync anchor
  if (result.nextAnchor) {
    await supabase.from('sync_anchors').upsert({
      user_id:         userId,
      source_platform: 'fitbit',
      last_sync_at:    result.nextAnchor.lastSyncAt.toISOString(),
      anchor_value:    result.nextAnchor.anchorValue,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,source_platform' });
  }

  console.log(`[fitbit-sync] ${userId}: ingested=${result.ingested} errors=${result.errors}`);
}
