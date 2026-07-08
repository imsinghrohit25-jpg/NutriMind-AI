// Alternative product retrieval — fetches candidate alternatives from the database.
// Candidates are products in the same category with a different barcode.
// Gate requirement: real alternatives with delta math.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AlternativeCandidate {
  productId:   string;
  barcode:     string;
  name:        string;
  brand?:      string;
  category:    string;
  healthScore: number;
  priceRs?:    number | null;  // optional price in Indian rupees
  source:      string;
}

export async function retrieveAlternatives(
  originalBarcode: string,
  category: string,
  originalHealthScore: number,
  supabase: SupabaseClient,
  limit = 10,
): Promise<AlternativeCandidate[]> {
  // Look up products in the same category, excluding the original product,
  // ordered by health score descending
  const { data, error } = await supabase
    .from('products')
    .select('id, barcode, name, brand, category, health_score, price_rs, source')
    .eq('category', category)
    .neq('barcode', originalBarcode)
    .order('health_score', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as Array<{
    id: string; barcode: string; name: string; brand?: string;
    category: string; health_score: number; price_rs?: number; source: string;
  }>).map((r) => ({
    productId:   r.id,
    barcode:     r.barcode,
    name:        r.name,
    brand:       r.brand,
    category:    r.category,
    healthScore: r.health_score,
    priceRs:     r.price_rs ?? null,
    source:      r.source,
  }));
}
