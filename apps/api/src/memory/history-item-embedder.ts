// AI Memory System — `embed-user-history` pg-boss job's real handler. Phase 12 (§13 job-stub
// wiring). Distinct from `history-embeddings.ts` (which embeds a fully-formed ScanEvent passed
// in-process at scan time): this job only receives `{ userId, sourceId, sourceType }` and must
// resolve the actual content itself. `sourceId` is a Layer-1 `user_events.event_id` — the
// episodic store is the traceable source of truth per §12.1 ("derived, never divined"), so
// resolving from there (rather than inventing a separate liked/disliked-food table) keeps this
// consistent with the rest of the memory architecture.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';
import { upsertMemoryEmbedding, type MemoryEmbeddingRefType } from './embeddings-service.js';
import type { MemoryEventType } from './types.js';

const VALID_REF_TYPES: readonly MemoryEmbeddingRefType[] =
  ['liked_food', 'disliked_food', 'feedback_text', 'recipe_interaction'];

interface UserEventRow {
  event_id:    string;
  event_type:  MemoryEventType;
  payload:     Record<string, unknown>;
}

/** Deterministic text rendering per event type — same "fixed template, no LLM" discipline as
 *  context-assembler.ts (Layer 4); only the fields relevant to a semantic "what did the user
 *  like/dislike/say/cook" query are surfaced. */
function buildHistoryText(row: UserEventRow): string {
  const p = row.payload;
  switch (row.event_type) {
    case 'food_logged':
      return `Logged food: ${p.foodName}${p.mealType ? ` (${p.mealType})` : ''}`;
    case 'recipe_cooked':
      return `Cooked recipe: ${p.recipeName}${p.cuisine ? `, ${p.cuisine} cuisine` : ''}${p.dietType ? `, ${p.dietType}` : ''}`;
    case 'meal_planned':
      return `Planned meal: ${p.recipeName ?? p.mealType}`;
    case 'meal_skipped':
      return `Skipped meal: ${p.mealType}`;
    case 'restaurant_visit':
      return `Visited restaurant${p.restaurantName ? `: ${p.restaurantName}` : ''}${p.cuisine ? ` (${p.cuisine})` : ''}`;
    case 'grocery_purchase':
      return `Purchased grocery item: ${p.itemName}${p.category ? ` (${p.category})` : ''}`;
    case 'feedback_given':
      return `Feedback on ${p.context}: ${p.text}`;
    case 'recommendation_accepted':
      return `Accepted a recommendation in category: ${p.category}`;
    case 'recommendation_rejected':
      return `Rejected a recommendation in category: ${p.category}${p.reason ? ` — reason: ${p.reason}` : ''}`;
    default:
      return `${row.event_type}: ${JSON.stringify(p)}`;
  }
}

export interface EmbedUserHistoryResult {
  embedded: boolean;
  reason?:  string;
}

export async function embedUserHistoryItem(
  userId: string,
  sourceId: string,
  sourceType: string,
  supabase: SupabaseClient,
  gateway: GatewayRouter,
): Promise<EmbedUserHistoryResult> {
  if (!VALID_REF_TYPES.includes(sourceType as MemoryEmbeddingRefType)) {
    return { embedded: false, reason: `unknown sourceType: ${sourceType}` };
  }

  const { data: row, error } = await supabase
    .from('user_events')
    .select('event_id, event_type, payload')
    .eq('event_id', sourceId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) return { embedded: false, reason: error.message };
  if (!row) return { embedded: false, reason: 'source event not found' };

  const text = buildHistoryText(row as unknown as UserEventRow);
  await upsertMemoryEmbedding(supabase, gateway, userId, sourceType as MemoryEmbeddingRefType, sourceId, text);
  return { embedded: true };
}
