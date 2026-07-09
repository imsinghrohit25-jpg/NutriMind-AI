// Fan-out for fitbit-sync / garmin-sync — finds every user with a live OAuth connection for the
// given provider and enqueues one incremental-sync job per user. Phase 12 (§13 job-stub wiring):
// fitbit-sync.ts/garmin-sync.ts had real per-user sync logic since Phase 13 (§R) but were never
// registered as pg-boss workers and had no fan-out to find *which* users to sync.

import type { SupabaseClient } from '@supabase/supabase-js';

export async function findUsersWithHealthProviderToken(
  supabase: SupabaseClient,
  provider: 'fitbit' | 'garmin',
): Promise<string[]> {
  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('user_id')
    .eq('provider', provider);

  if (error) throw new Error(`findUsersWithHealthProviderToken(${provider}): ${error.message}`);
  return [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))];
}
