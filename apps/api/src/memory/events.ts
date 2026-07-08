// AI Memory System — Layer 1 (episodic memory). Phase 11 (§12.2).
// Append-only event recording. This is the ONLY way a fact can ever exist — a Layer 2
// aggregation fact's `derived_from` must point back to real rows here (see aggregation/*.ts).
// Never called from anywhere that would block or fail the primary action it's attached to —
// callers should treat recordEvent() as best-effort telemetry, not a transactional dependency
// (matches this codebase's existing pattern for enqueueProductEmbedding in resolve.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemoryEventType, MemoryEventPayloads } from './types.js';

export async function recordEvent<T extends MemoryEventType>(
  supabase: SupabaseClient,
  userId: string,
  eventType: T,
  payload: MemoryEventPayloads[T],
  opts: { source?: string; occurredAt?: Date } = {},
): Promise<void> {
  const { error } = await supabase.from('user_events').insert({
    user_id: userId,
    event_type: eventType,
    payload,
    occurred_at: (opts.occurredAt ?? new Date()).toISOString(),
    source: opts.source ?? 'api',
  });
  if (error) throw new Error(`recordEvent(${eventType}): ${error.message}`);
}

/** Fire-and-forget wrapper — logs but never throws. Use at call sites where memory recording
 *  must not affect the primary action's success/failure (the documented, established pattern
 *  for this project's best-effort side-writes, e.g. resolve.ts's embedding enqueue). */
export function recordEventBestEffort<T extends MemoryEventType>(
  supabase: SupabaseClient,
  userId: string,
  eventType: T,
  payload: MemoryEventPayloads[T],
  opts: { source?: string; occurredAt?: Date } = {},
): void {
  recordEvent(supabase, userId, eventType, payload, opts).catch((err) => {
    console.warn('[memory] recordEvent failed (non-fatal):', eventType, err instanceof Error ? err.message : err);
  });
}

export interface EventQuery {
  eventTypes?: MemoryEventType[];
  from?: Date;
  to?: Date;
  limit?: number;
}

interface UserEventRow {
  event_id: string;
  user_id: string;
  event_type: MemoryEventType;
  payload: unknown;
  occurred_at: string;
  source: string;
}

export interface StoredMemoryEvent {
  eventId: string;
  userId: string;
  eventType: MemoryEventType;
  payload: unknown;
  occurredAt: Date;
  source: string;
}

/** Fetch a user's own event history — used by aggregation jobs and the transparency UI. */
export async function getEvents(
  supabase: SupabaseClient,
  userId: string,
  query: EventQuery = {},
): Promise<StoredMemoryEvent[]> {
  let q = supabase
    .from('user_events')
    .select('event_id, user_id, event_type, payload, occurred_at, source')
    .eq('user_id', userId);

  if (query.eventTypes?.length) q = q.in('event_type', query.eventTypes);
  if (query.from) q = q.gte('occurred_at', query.from.toISOString());
  if (query.to) q = q.lte('occurred_at', query.to.toISOString());

  const { data, error } = await q.order('occurred_at', { ascending: false }).limit(query.limit ?? 500);
  if (error) throw new Error(`getEvents: ${error.message}`);

  return (data as UserEventRow[] ?? []).map((row) => ({
    eventId: row.event_id,
    userId: row.user_id,
    eventType: row.event_type,
    payload: row.payload,
    occurredAt: new Date(row.occurred_at),
    source: row.source,
  }));
}
