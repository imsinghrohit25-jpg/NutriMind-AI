// General privacy consent service — Phase 8 (`global.p8.gdpr_consent_flow`, `dpdp_consent_flow`).
// Wraps `user_consents` (migration 0002, extended by 0021 with `granted`) — an append-only
// consent event log. Distinct from `health/consent.ts`'s `health_consents` table: that one is
// the narrower, already-enforced per-metric-type *sync* consent (Health Data Platform); this one
// is the broader legal consent for processing purposes at all (GDPR Art. 9 / DPDP Sec. 6).
// Withdrawal is a new row with `granted: false`, never a mutation — the table's design intent
// (migration 0002: "append-only; never update existing rows") is preserved.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsentType } from './regime.js';

export interface ConsentMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface ConsentStatus {
  consentType: ConsentType;
  granted: boolean;
  version: string;
  recordedAt: Date;
}

interface ConsentRow {
  consent_type: string;
  version: string;
  granted: boolean;
  accepted_at: string;
}

async function insertConsentEvent(
  supabase: SupabaseClient,
  userId: string,
  consentType: ConsentType,
  version: string,
  granted: boolean,
  meta: ConsentMeta,
): Promise<void> {
  const { error } = await supabase.from('user_consents').insert({
    user_id: userId,
    consent_type: consentType,
    version,
    granted,
    ip_address: meta.ipAddress ?? null,
    user_agent: meta.userAgent ?? null,
  });
  if (error) throw new Error(`recordConsent: ${error.message}`);
}

/** Record a consent grant event. Idempotent per (userId, consentType, version): a second grant
 *  for an already-granted version is rejected by the DB's unique constraint — call
 *  `getConsentStatus` first to check current state. */
export function recordConsent(
  supabase: SupabaseClient,
  userId: string,
  consentType: ConsentType,
  version: string,
  meta: ConsentMeta = {},
): Promise<void> {
  return insertConsentEvent(supabase, userId, consentType, version, true, meta);
}

/** Record a withdrawal event for `consentType` at `version` — GDPR Art. 7(3) / DPDP Sec. 6(4)
 *  both require withdrawal to be as easy as granting. */
export function withdrawConsent(
  supabase: SupabaseClient,
  userId: string,
  consentType: ConsentType,
  version: string,
  meta: ConsentMeta = {},
): Promise<void> {
  return insertConsentEvent(supabase, userId, consentType, version, false, meta);
}

/** Full append-only consent event history for a user, oldest first. */
export async function getConsentHistory(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConsentStatus[]> {
  const { data, error } = await supabase
    .from('user_consents')
    .select('consent_type, version, granted, accepted_at')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: true });

  if (error) throw new Error(`getConsentHistory: ${error.message}`);

  return (data as ConsentRow[] ?? []).map((row) => ({
    consentType: row.consent_type as ConsentType,
    granted: row.granted,
    version: row.version,
    recordedAt: new Date(row.accepted_at),
  }));
}

/** Current status per consent type — the latest event (grant or withdrawal) wins. */
export async function getConsentStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConsentStatus[]> {
  const history = await getConsentHistory(supabase, userId);
  const latest = new Map<ConsentType, ConsentStatus>();
  for (const event of history) {
    latest.set(event.consentType, event); // history is oldest-first, so later iterations win
  }
  return [...latest.values()];
}
