// Product embedding pipeline.
// Builds a text representation of a product for embedding, then stores the vector
// in product_embeddings via the gateway router (embeddings task tier).
// Called after a new product is persisted; runs as a pg-boss job.

import type postgres from 'postgres';
import type { GatewayRouter } from '../gateway/router.js';

type Sql = postgres.Sql;

interface ProductEmbeddingRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  ingredients_text: string | null;
  energy_kcal: string | null;
  protein_g: string | null;
  fat_total_g: string | null;
  carbohydrates_g: string | null;
}

function buildEmbeddingText(row: ProductEmbeddingRow): string {
  const parts: string[] = [];
  parts.push(row.name);
  if (row.brand) parts.push(`Brand: ${row.brand}`);
  if (row.category) parts.push(`Category: ${row.category}`);
  if (row.energy_kcal) parts.push(`Energy: ${row.energy_kcal} kcal`);
  if (row.protein_g) parts.push(`Protein: ${row.protein_g}g`);
  if (row.fat_total_g) parts.push(`Fat: ${row.fat_total_g}g`);
  if (row.carbohydrates_g) parts.push(`Carbs: ${row.carbohydrates_g}g`);
  if (row.ingredients_text) {
    // Truncate ingredients to avoid token limit
    const truncated = row.ingredients_text.slice(0, 500);
    parts.push(`Ingredients: ${truncated}`);
  }
  return parts.join('. ');
}

export async function processProductEmbedding(
  productId: string,
  deps: { sql: Sql; gateway: GatewayRouter },
): Promise<void> {
  const { sql, gateway } = deps;

  // Fetch product + nutrition for embedding text
  const rows = await sql<ProductEmbeddingRow[]>`
    SELECT
      p.id, p.name, p.brand, p.category,
      pi.raw_text AS ingredients_text,
      pn.energy_kcal, pn.protein_g, pn.fat_total_g, pn.carbohydrates_g
    FROM public.products p
    LEFT JOIN public.product_nutrition pn ON pn.product_id = p.id
    LEFT JOIN public.product_ingredients pi ON pi.product_id = p.id
    WHERE p.id = ${productId}
    LIMIT 1
  `;

  if (!rows.length) {
    console.warn('[embed-product] product not found:', productId);
    return;
  }

  const text = buildEmbeddingText(rows[0]!);
  const embeddingResp = await gateway.embed({
    input: [text],
    traceId: crypto.randomUUID(),
  });

  const vector = embeddingResp.embeddings[0];
  if (!vector?.length) {
    console.warn('[embed-product] empty embedding for product:', productId);
    return;
  }

  const inputFields = ['name', 'brand', 'category', 'nutrition', 'ingredients'];

  // Store in product_embeddings table (migration 0008_knowledge_vectors.sql)
  await sql`
    INSERT INTO public.product_embeddings (product_id, embedding, embedding_model, embedded_at, input_fields)
    VALUES (
      ${productId},
      ${JSON.stringify(vector)}::vector,
      ${embeddingResp.model},
      NOW(),
      ${sql.array(inputFields)}
    )
    ON CONFLICT (product_id) DO UPDATE SET
      embedding       = EXCLUDED.embedding,
      embedding_model = EXCLUDED.embedding_model,
      embedded_at     = NOW(),
      input_fields    = EXCLUDED.input_fields
  `;

  console.log('[embed-product] embedded product', productId, 'dim:', vector.length);
}

export async function enqueueProductEmbedding(boss: import('pg-boss'), productId: string): Promise<void> {
  await boss.send('embed-product', { productId }, { retryLimit: 3, retryDelay: 30 });
}
