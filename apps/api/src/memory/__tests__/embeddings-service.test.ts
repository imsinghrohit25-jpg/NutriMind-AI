import { describe, it, expect, vi } from 'vitest';
import { upsertMemoryEmbedding, retrieveSimilarMemories, deleteMemoryEmbedding } from '../embeddings-service.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.upsert = vi.fn(() => Promise.resolve(resolved));
  chain.delete = vi.fn(self);
  let eqCalls = 0;
  chain.eq = vi.fn(() => (++eqCalls >= 2 ? Promise.resolve(resolved) : chain));
  return chain;
}

function fakeGateway(vector: number[] | null = [0.1, 0.2, 0.3]) {
  return { embed: vi.fn(() => Promise.resolve({ embeddings: vector ? [vector] : [], model: 'test-model' })) };
}

describe('upsertMemoryEmbedding', () => {
  it('embeds the text and upserts with the correct conflict target', async () => {
    const chain = makeChainable({});
    const supabase = { from: vi.fn(() => chain) };
    const gateway = fakeGateway();

    await upsertMemoryEmbedding(supabase as never, gateway as never, 'user-1', 'liked_food', 'dal-1', 'masoor dal');

    expect(gateway.embed).toHaveBeenCalledWith(expect.objectContaining({ input: ['masoor dal'] }));
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', ref_type: 'liked_food', ref_id: 'dal-1', embedding: [0.1, 0.2, 0.3] }),
      { onConflict: 'user_id,ref_type,ref_id' },
    );
  });

  it('throws when the gateway returns an empty embedding', async () => {
    const supabase = { from: vi.fn() };
    const gateway = fakeGateway(null);
    await expect(upsertMemoryEmbedding(supabase as never, gateway as never, 'user-1', 'liked_food', 'x', 'text'))
      .rejects.toThrow(/empty embedding/);
  });
});

describe('retrieveSimilarMemories', () => {
  it('calls the match_user_memory RPC with the embedded query and maps results', async () => {
    const rows = [{ ref_type: 'liked_food', ref_id: 'dal-1', text_content: 'masoor dal', similarity: 0.92 }];
    const supabase = { rpc: vi.fn(() => Promise.resolve({ data: rows, error: null })) };
    const gateway = fakeGateway();

    const results = await retrieveSimilarMemories(supabase as never, gateway as never, 'user-1', 'lentil curry');

    expect(supabase.rpc).toHaveBeenCalledWith('match_user_memory', expect.objectContaining({ p_user_id: 'user-1' }));
    expect(results[0]!.similarity).toBe(0.92);
  });

  it('returns an empty array without calling the RPC when embedding fails', async () => {
    const supabase = { rpc: vi.fn() };
    const gateway = fakeGateway(null);
    const results = await retrieveSimilarMemories(supabase as never, gateway as never, 'user-1', 'x');
    expect(results).toEqual([]);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('deleteMemoryEmbedding', () => {
  it('deletes scoped to both id and userId', async () => {
    const chain = makeChainable({});
    const supabase = { from: vi.fn(() => chain) };
    await deleteMemoryEmbedding(supabase as never, 'user-1', 'embed-1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'embed-1');
  });
});
