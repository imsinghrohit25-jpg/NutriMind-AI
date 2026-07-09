import { describe, it, expect, vi } from 'vitest';
import { embedUserHistoryItem } from '../history-item-embedder.js';

function makeSupabase(eventRow: unknown, upsert = vi.fn(() => Promise.resolve({ data: null, error: null }))) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'user_events') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: eventRow, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'user_memory_embeddings') {
        return { upsert };
      }
      throw new Error(`unexpected table: ${table}`);
    }),
  };
}

function makeGateway() {
  return { embed: vi.fn(() => Promise.resolve({ embeddings: [[0.1, 0.2, 0.3]] })) };
}

describe('embedUserHistoryItem', () => {
  it('rejects an unknown sourceType without querying anything', async () => {
    const supabase = makeSupabase(null);
    const gateway = makeGateway();
    const result = await embedUserHistoryItem('u1', 'e1', 'not_a_real_type', supabase as never, gateway as never);
    expect(result).toEqual({ embedded: false, reason: 'unknown sourceType: not_a_real_type' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('reports the source event as not found', async () => {
    const supabase = makeSupabase(null);
    const gateway = makeGateway();
    const result = await embedUserHistoryItem('u1', 'e1', 'liked_food', supabase as never, gateway as never);
    expect(result).toEqual({ embedded: false, reason: 'source event not found' });
  });

  it('builds text from a recommendation_rejected event and upserts the embedding', async () => {
    const upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const supabase = makeSupabase(
      { event_id: 'e1', event_type: 'recommendation_rejected', payload: { recommendationId: 'r1', category: 'fried_snacks', reason: 'too salty' } },
      upsert,
    );
    const gateway = makeGateway();

    const result = await embedUserHistoryItem('u1', 'e1', 'feedback_text', supabase as never, gateway as never);

    expect(result).toEqual({ embedded: true });
    expect(gateway.embed).toHaveBeenCalledWith(expect.objectContaining({
      input: ['Rejected a recommendation in category: fried_snacks — reason: too salty'],
    }));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', ref_type: 'feedback_text', ref_id: 'e1' }),
      expect.anything(),
    );
  });

  it('builds text for a recipe_cooked event', async () => {
    const supabase = makeSupabase(
      { event_id: 'e2', event_type: 'recipe_cooked', payload: { recipeName: 'Dal Tadka', cuisine: 'north_indian', dietType: 'vegetarian' } },
    );
    const gateway = makeGateway();

    const result = await embedUserHistoryItem('u1', 'e2', 'recipe_interaction', supabase as never, gateway as never);

    expect(result).toEqual({ embedded: true });
    expect(gateway.embed).toHaveBeenCalledWith(expect.objectContaining({
      input: ['Cooked recipe: Dal Tadka, north_indian cuisine, vegetarian'],
    }));
  });
});
