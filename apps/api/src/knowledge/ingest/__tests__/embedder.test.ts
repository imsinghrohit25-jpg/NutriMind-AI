import { describe, it, expect, vi } from 'vitest';
import { embedChunkById } from '../embedder.js';

function makeGateway() {
  return { embed: vi.fn(() => Promise.resolve({ embeddings: [[0.1, 0.2]], model: 'test-embed-model' })) };
}

describe('embedChunkById', () => {
  it('reports a missing chunk without calling the gateway', async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'no rows' } }) }) }) }),
    };
    const gateway = makeGateway();

    const result = await embedChunkById('doc:1', supabase as never, gateway as never);

    expect(result).toEqual({ chunkId: 'doc:1', embedded: false, error: 'no rows' });
    expect(gateway.embed).not.toHaveBeenCalled();
  });

  it('re-embeds an existing chunk row and upserts it back with its own corpus_version', async () => {
    const row = {
      id: 'fssai:3', doc_id: 'fssai-2022', title: 'FSSAI Labelling Regs', source: 'FSSAI',
      year: 2022, text: 'Sodium limits...', metadata: { section: '4.2' }, corpus_version: 'v3',
    };
    const upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const supabase = {
      from: (table: string) => {
        if (table === 'knowledge_chunks') {
          return {
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }),
            upsert,
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const gateway = makeGateway();

    const result = await embedChunkById('fssai:3', supabase as never, gateway as never);

    expect(result).toEqual({ chunkId: 'fssai:3', embedded: true });
    expect(gateway.embed).toHaveBeenCalledWith(expect.objectContaining({ input: 'Sodium limits...' }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'fssai:3', corpus_version: 'v3' }));
  });
});
