// Scan history embeddings — embeds each scan event as a vector for semantic search.
// Stored in `scan_history_embeddings` Supabase table (pgvector).
// Gate requirement: history semantic search works.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';

export interface ScanEvent {
  scanId:      string;
  userId:      string;
  productName: string;
  healthScore: number;
  band:        string;
  sodiumMg?:   number | null;
  sugarsG?:    number | null;
  proteinG?:   number | null;
  category?:   string | null;
  scannedAt:   string;
}

function buildEmbeddingText(scan: ScanEvent): string {
  const parts = [
    `Product: ${scan.productName}`,
    `Health score: ${scan.healthScore}/100 (${scan.band})`,
    scan.sodiumMg  != null ? `Sodium: ${scan.sodiumMg}mg/100g` : null,
    scan.sugarsG   != null ? `Sugar: ${scan.sugarsG}g/100g` : null,
    scan.proteinG  != null ? `Protein: ${scan.proteinG}g/100g` : null,
    scan.category  != null ? `Category: ${scan.category}` : null,
  ];
  return parts.filter(Boolean).join('; ');
}

export async function embedScanHistory(
  scan: ScanEvent,
  supabase: SupabaseClient,
  gateway: GatewayRouter,
): Promise<void> {
  const text = buildEmbeddingText(scan);

  const embResponse = await gateway.embed({
    input:   text,
    traceId: `history:${scan.scanId}`,
    userId:  scan.userId,
  });
  const embedding = embResponse.embeddings[0];

  await supabase.from('scan_history_embeddings').upsert({
    scan_id:     scan.scanId,
    user_id:     scan.userId,
    text,
    embedding,
    health_score: scan.healthScore,
    band:         scan.band,
    scanned_at:   scan.scannedAt,
    metadata: {
      product_name: scan.productName,
      category:     scan.category,
    },
  });
}
