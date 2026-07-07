// USDA FoodData Central REST client.
// Rate limit: 1,000 req/hour/key (api.data.gov). Cache-first: every response persisted to DB.
// Preferred data types for whole/reference foods: Foundation, SR Legacy.

interface UsdaTokenBucket {
  tokens: number;
  lastRefill: number;
}

function createUsdaBucket(): UsdaTokenBucket {
  return { tokens: 1000, lastRefill: Date.now() };
}

async function acquireUsdaToken(bucket: UsdaTokenBucket): Promise<void> {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const refillPerMs = 1000 / 3_600_000;
  bucket.tokens = Math.min(1000, bucket.tokens + elapsed * refillPerMs);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) {
    const waitMs = Math.ceil((1 - bucket.tokens) / refillPerMs);
    await new Promise<void>((r) => setTimeout(r, waitMs));
    bucket.tokens = 0;
  } else {
    bucket.tokens -= 1;
  }
}

export interface UsdaNutrient {
  nutrient: {
    id: number;
    name: string;
    unitName: string;
  };
  amount: number;
}

export interface UsdaFoodPortion {
  amount: number;
  modifier: string;
  gramWeight: number;
}

export interface UsdaFoodDetail {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: UsdaNutrient[];
  foodPortions?: UsdaFoodPortion[];
}

export interface UsdaSearchResult {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
}

interface UsdaSearchResponse {
  totalHits: number;
  foods: UsdaSearchResult[];
}

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

export class UsdaFdcClient {
  private readonly bucket: UsdaTokenBucket;

  constructor(private readonly apiKey: string) {
    this.bucket = createUsdaBucket();
  }

  async getFoodById(fdcId: number): Promise<UsdaFoodDetail | null> {
    await acquireUsdaToken(this.bucket);
    const url = `${FDC_BASE}/food/${fdcId}?api_key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`USDA FDC API ${res.status} for fdcId ${fdcId}`);
    return (await res.json()) as UsdaFoodDetail;
  }

  // Searches Foundation and SR Legacy datasets (whole foods) by default.
  async searchFoods(
    query: string,
    dataTypes: string[] = ['Foundation', 'SR Legacy'],
    pageSize = 10,
  ): Promise<UsdaSearchResult[]> {
    await acquireUsdaToken(this.bucket);
    const url = `${FDC_BASE}/foods/search?api_key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, dataType: dataTypes, pageSize }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as UsdaSearchResponse;
    return data.foods ?? [];
  }
}
