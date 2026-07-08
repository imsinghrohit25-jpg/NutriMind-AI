// AI Memory System — Layer 2 (derived profile) persistence. Phase 11 (§12.2).
// Persists FactCandidate[] (pure aggregation output) to user_memory_facts. This is the ONLY
// write path into that table from application code — the DB's RLS policy also enforces this by
// granting owners SELECT/DELETE but not INSERT/UPDATE (migration 0023), so only the service-role
// aggregation job can write facts; a user can inspect and delete, never fabricate, their own
// memory.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FactCandidate, MemoryFactType } from './aggregation/types.js';

export async function persistFacts(
  supabase: SupabaseClient,
  userId: string,
  facts: FactCandidate[],
  computedAt: Date = new Date(),
): Promise<void> {
  if (facts.length === 0) return;

  const rows = facts.map((f) => ({
    user_id: userId,
    fact_type: f.factType,
    fact_key: f.factKey,
    value: f.value,
    confidence: f.confidence,
    derived_from: f.derivedFrom,
    computed_at: computedAt.toISOString(),
    valid_until: new Date(computedAt.getTime() + f.ttlDays * 86_400_000).toISOString(),
  }));

  const { error } = await supabase
    .from('user_memory_facts')
    .upsert(rows, { onConflict: 'user_id,fact_type,fact_key' });

  if (error) throw new Error(`persistFacts: ${error.message}`);
}

export interface StoredMemoryFact {
  factId: string;
  factType: MemoryFactType;
  factKey: string;
  value: Record<string, unknown>;
  confidence: number;
  derivedFrom: string[];
  computedAt: Date;
  validUntil: Date;
}

interface FactRow {
  fact_id: string;
  fact_type: MemoryFactType;
  fact_key: string;
  value: Record<string, unknown>;
  confidence: number;
  derived_from: string[];
  computed_at: string;
  valid_until: string;
}

/** All facts for a user (transparency UI + context assembly). `activeOnly` excludes decayed
 *  (valid_until < now) facts — pass `false` to include them for audit/history views. */
export async function getFacts(
  supabase: SupabaseClient,
  userId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<StoredMemoryFact[]> {
  let q = supabase.from('user_memory_facts').select('*').eq('user_id', userId);
  if (opts.activeOnly !== false) q = q.gte('valid_until', new Date().toISOString());

  const { data, error } = await q.order('computed_at', { ascending: false });
  if (error) throw new Error(`getFacts: ${error.message}`);

  return (data as FactRow[] ?? []).map((row) => ({
    factId: row.fact_id,
    factType: row.fact_type,
    factKey: row.fact_key,
    value: row.value,
    confidence: row.confidence,
    derivedFrom: row.derived_from,
    computedAt: new Date(row.computed_at),
    validUntil: new Date(row.valid_until),
  }));
}

/** Per-item delete (memory transparency UI). RLS also allows this directly from the client, but
 *  the API route exists so mobile doesn't need direct table access. */
export async function deleteFact(supabase: SupabaseClient, userId: string, factId: string): Promise<void> {
  const { error } = await supabase.from('user_memory_facts').delete().eq('fact_id', factId).eq('user_id', userId);
  if (error) throw new Error(`deleteFact: ${error.message}`);
}
