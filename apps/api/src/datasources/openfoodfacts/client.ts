// OpenFoodFacts HTTP client.
// Etiquette: descriptive User-Agent, 60 req/min token-bucket throttle, cache-first discipline
// (persistent cache in `cache.ts` ensures second lookup never re-hits OFF).

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillPerMs: number;
}

function createBucket(maxPerMin: number): TokenBucket {
  return {
    tokens: maxPerMin,
    lastRefill: Date.now(),
    maxTokens: maxPerMin,
    refillPerMs: maxPerMin / 60_000,
  };
}

async function acquireToken(bucket: TokenBucket): Promise<void> {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillPerMs);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) {
    const waitMs = Math.ceil((1 - bucket.tokens) / bucket.refillPerMs);
    await new Promise<void>((r) => setTimeout(r, waitMs));
    bucket.tokens = 0;
  } else {
    bucket.tokens -= 1;
  }
}

// Field subset requested from OFF to reduce payload size.
const PRODUCT_FIELDS = [
  '_id', 'product_name', 'product_name_en', 'brands',
  'categories_tags', 'sub_categories_tags', 'countries_tags',
  'image_url', 'image_small_url', 'serving_size', 'quantity',
  'nutriments', 'ingredients_text', 'ingredients_text_en',
  'nova_group', 'labels_tags', 'allergens_tags',
].join(',');

export interface OFFNutriments {
  'energy-kcal_100g'?: number;
  'energy-kj_100g'?: number;
  proteins_100g?: number;
  fat_100g?: number;
  'saturated-fat_100g'?: number;
  'trans-fat_100g'?: number;
  'polyunsaturated-fat_100g'?: number;
  'monounsaturated-fat_100g'?: number;
  carbohydrates_100g?: number;
  sugars_100g?: number;
  'added-sugars_100g'?: number;
  fiber_100g?: number;
  // Minerals: g/100g in OFF — multiply ×1000 for mg
  sodium_100g?: number;
  cholesterol_100g?: number;
  calcium_100g?: number;
  iron_100g?: number;
  potassium_100g?: number;
  zinc_100g?: number;
  // Vitamins: mg/100g in OFF
  'vitamin-c_100g'?: number;
  'vitamin-a_100g'?: number;  // mcg/100g (RAE)
  'vitamin-d_100g'?: number;  // mcg/100g
  'vitamin-b12_100g'?: number;
  folate_100g?: number;
}

export interface OFFProduct {
  _id: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  categories_tags?: string[];
  sub_categories_tags?: string[];
  countries_tags?: string[];
  image_url?: string;
  image_small_url?: string;
  serving_size?: string;
  quantity?: string;
  nutriments?: OFFNutriments;
  ingredients_text?: string;
  ingredients_text_en?: string;
  nova_group?: number;
  labels_tags?: string[];
  allergens_tags?: string[];
}

interface OFFProductApiResponse {
  status: number;
  product?: OFFProduct;
}

interface OFFSearchApiResponse {
  count: number;
  page: number;
  page_size: number;
  products?: OFFProduct[];
}

export class OpenFoodFactsClient {
  private readonly bucket: TokenBucket;

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
  ) {
    this.bucket = createBucket(60);
  }

  async getProduct(barcode: string): Promise<OFFProduct | null> {
    await acquireToken(this.bucket);
    const url = `${this.baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${PRODUCT_FIELDS}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`OFF API ${res.status} for barcode ${barcode}`);
    const data = (await res.json()) as OFFProductApiResponse;
    if (data.status !== 1 || !data.product) return null;
    return data.product;
  }

  // India-first search: applies countries_tags filter when country is provided.
  async searchByName(query: string, countriesTag?: string): Promise<OFFProduct[]> {
    await acquireToken(this.bucket);
    const params = new URLSearchParams({
      action: 'process',
      json: '1',
      search_terms: query,
      page_size: '10',
      fields: '_id,product_name,brands,categories_tags,nutriments,image_url',
    });
    if (countriesTag) params.set('countries_tags', countriesTag);
    const url = `${this.baseUrl}/cgi/search.pl?${params.toString()}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OFFSearchApiResponse;
    return data.products ?? [];
  }
}
