// Per-datatype consent management.
// Consent records are versioned; revocation stops sync AND deletes previously synced data.
// Gate: revoking a metric type calls this module which triggers deletion.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetricType, ConsentRecord } from './types.js';

export async function getConsents(
  userId:   string,
  supabase: SupabaseClient,
): Promise<ConsentRecord[]> {
  const { data, error } = await supabase
    .from('health_consents')
    .select('*')
    .eq('user_id', userId);

  if (error) throw new Error(`getConsents: ${error.message}`);
  return (data ?? []).map((r) => ({
    userId:         r.user_id as string,
    metricType:     r.metric_type as MetricType,
    granted:        r.granted as boolean,
    consentVersion: r.consent_version as number,
    grantedAt:      r.granted_at ? new Date(r.granted_at as string) : undefined,
    revokedAt:      r.revoked_at ? new Date(r.revoked_at as string) : undefined,
  }));
}

export async function grantConsent(
  userId:     string,
  metricType: MetricType,
  supabase:   SupabaseClient,
): Promise<void> {
  const { error } = await supabase.from('health_consents').upsert({
    user_id:          userId,
    metric_type:      metricType,
    granted:          true,
    granted_at:       new Date().toISOString(),
    revoked_at:       null,
    consent_version:  1,
    updated_at:       new Date().toISOString(),
  }, { onConflict: 'user_id,metric_type' });

  if (error) throw new Error(`grantConsent: ${error.message}`);
}

/** Revoke consent and DELETE all previously synced data of this metric type. */
export async function revokeConsent(
  userId:     string,
  metricType: MetricType,
  supabase:   SupabaseClient,
): Promise<{ deletedRows: number }> {
  // 1. Mark consent as revoked
  const { error: consentError } = await supabase
    .from('health_consents')
    .upsert({
      user_id:         userId,
      metric_type:     metricType,
      granted:         false,
      revoked_at:      new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,metric_type' });

  if (consentError) throw new Error(`revokeConsent (consent): ${consentError.message}`);

  // 2. Delete all synced data of this type — gate: revocation-with-deletion path
  const { data: deleted, error: deleteError } = await supabase
    .from('health_metrics')
    .delete()
    .eq('user_id', userId)
    .eq('metric_type', metricType)
    .select('id');

  if (deleteError) throw new Error(`revokeConsent (delete): ${deleteError.message}`);

  const deletedRows = deleted?.length ?? 0;
  console.log(`[consent] Revoked ${metricType} for ${userId}; deleted ${deletedRows} rows`);
  return { deletedRows };
}

/** Returns the set of metric types this user has actively consented to. */
export async function grantedMetricTypes(
  userId:   string,
  supabase: SupabaseClient,
): Promise<MetricType[]> {
  const consents = await getConsents(userId, supabase);
  return consents.filter((c) => c.granted).map((c) => c.metricType);
}
