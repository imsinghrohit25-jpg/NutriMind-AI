// Processing restriction service — Phase 8 (`global.p8.dsr_endpoints`).
// GDPR Art. 18 / DPDP Act 2023 Sec. 12: a data subject can request processing be paused without
// full erasure. Wraps `processing_restrictions` (migration 0022) — append-only, same shape as
// `user_consents`. Recording a restriction here is real and queryable, but does NOT itself pause
// any processing pipeline: no consumer (score engine, copilot, analytics) checks this flag yet.
// That is a named, tracked gap (ADR-0021), the same "engine capable, not yet wired everywhere"
// pattern as ADR-0017's `computeHealthScore` country parameter.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RestrictionStatus {
  restricted: boolean;
  reason: string | null;
  recordedAt: Date;
}

async function insertRestrictionEvent(
  supabase: SupabaseClient,
  userId: string,
  restricted: boolean,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.from('processing_restrictions').insert({
    user_id: userId,
    restricted,
    reason: reason ?? null,
  });
  if (error) throw new Error(`processingRestriction: ${error.message}`);
}

export function requestRestriction(
  supabase: SupabaseClient,
  userId: string,
  reason?: string,
): Promise<void> {
  return insertRestrictionEvent(supabase, userId, true, reason);
}

export function liftRestriction(
  supabase: SupabaseClient,
  userId: string,
  reason?: string,
): Promise<void> {
  return insertRestrictionEvent(supabase, userId, false, reason);
}

/** Current restriction status — the latest recorded event wins. `null` if never requested. */
export async function getRestrictionStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<RestrictionStatus | null> {
  const { data, error } = await supabase
    .from('processing_restrictions')
    .select('restricted, reason, recorded_at')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getRestrictionStatus: ${error.message}`);
  if (!data) return null;

  return {
    restricted: data.restricted as boolean,
    reason: (data.reason as string | null) ?? null,
    recordedAt: new Date(data.recorded_at as string),
  };
}
