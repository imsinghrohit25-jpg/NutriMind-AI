# NutriMind AI — API Reference

Base URL: `https://api.nutrimind.app/api/v1`  
Auth: `Authorization: Bearer <supabase-jwt>` on all routes except `/health`

---

## Health

### `GET /health`
Returns `{ status: "ok", version: "1.0.0" }`. No auth required.

---

## Scan / Product Resolution

### `GET /scan/:barcode`
Resolves a barcode via cache → OpenFoodFacts → USDA → LLM-assist waterfall.

**Response 200:**
```json
{
  "productId": "uuid",
  "name": "Maggi 2-Minute Noodles",
  "brand": "Nestlé",
  "barcode": "8901058818829",
  "healthScore": 22,
  "band": "poor",
  "novaGroup": 4,
  "subScores": { "sodium": 30, "sugar": 70, "satFat": 65, "transFat": 80, "fibre": 0, "protein": 25 },
  "allergens": [],
  "nutrition": { "energyKcal": 350, "sodiumMg": 900, "sugarsG": 2.5, "proteinG": 8 }
}
```

**Response 404:** Product not found in any data source.

---

## Score Engine

### `POST /score`
Compute health score for supplied nutrition data. Deterministic — no LLM.

**Request body:**
```json
{
  "sodiumMg": 900,
  "sugarsG": 2.5,
  "sugarsAddedG": null,
  "fatSaturatedG": 4.5,
  "fatTransG": 0.1,
  "dietaryFiberG": 0.5,
  "proteinG": 8,
  "ingredientNames": ["wheat flour", "palm oil", "e211", "maltodextrin"]
}
```

**Response 200:** `HealthScoreResult` with `score`, `band`, `subScores`, `nova`, `weights`.

---

## Copilot (RAG)

### `POST /copilot/chat`
Sends a nutrition question to the RAG copilot. Returns SSE stream.

**Request body:**
```json
{
  "query": "Is this product safe for someone with hypertension?",
  "productContext": { "name": "...", "sodiumMg": 900 },
  "sessionId": "uuid"
}
```

**Response:** `text/event-stream`
```
data: {"delta": "Based on the WHO 2023 guidelines..."}
data: {"delta": "..."}
data: {"done": true, "citations": [{"source": "who-sodium-2023", "text": "..."}], "grounded": true}
```

**Response 422:** Guardrail triggered
```json
{ "blocked": true, "category": "medication", "message": "I can't advise on medications." }
```

---

## Meals

### `POST /meals/aggregate`
Aggregate a day's meal entries into daily nutrition totals.

**Request body:** `{ "date": "2026-07-07", "entries": [MealEntry, ...] }`  
**Response 200:** `DailyNutritionTotal`

### `POST /meals/gaps`
Compute gap analysis against daily budget.

**Request body:** `{ "total": DailyNutritionTotal, "budget": DailyBudget, "memberName": "Rohit" }`  
**Response 200:** `DailyGapReport` with per-nutrient status and pctOfBudget.

---

## Cart

### `POST /cart/score`
Compute quantity-weighted cart health score.

**Request body:** `{ "items": [{ "productId": "...", "healthScore": 45, "quantity": 2 }] }`  
**Response 200:** `CartScoreResult` with `overallScore`, `itemContributions`.

### `POST /cart/rollup`
Family cart rollup — aggregates per-member scores and surfaces allergen conflicts.

**Request body:** `{ "memberResults": [MemberCartResult, ...] }`  
**Response 200:** `CartRollupResult`

---

## Alternatives

### `GET /alternatives/:barcode`
Returns ranked healthier alternatives for the given product.

**Query params:**
- `maxPriceRs` (number) — filter by budget
- `limit` (number, default 5) — cap results

**Response 200:**
```json
{
  "ranked": [{ "name": "...", "healthScore": 65, "scoreDelta": 43, "isBudgetOption": false }],
  "thinCategory": false,
  "thinMessage": null
}
```

---

## Memory / History Search

### `POST /memory/search`
Semantic search over user's scan history.

**Request body:** `{ "query": "high sodium snacks I scanned last month" }`  
**Response 200:** `HistorySearchResult[]` with similarity scores.

---

## Data Rights

### `POST /data-rights/export`
Returns JSON export of all user PII tables. Response is downloaded as a file.

### `POST /data-rights/delete`
Hard deletes all user data. Returns verification query results (all row counts = 0).

---

## Push Preferences

### `GET /push/preferences`
Returns current push notification preferences.

### `PUT /push/preferences`
Updates push preferences.

**Request body:** `{ "weeklyReport": true, "allergenAlert": true, "budgetOverrun": false }`

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Validation error — missing or malformed fields |
| 401 | Missing or invalid JWT |
| 403 | Forbidden — JWT user does not match resource owner |
| 404 | Resource not found |
| 422 | Guardrail triggered (copilot only) |
| 429 | Rate limit exceeded (100 req/min per user) |
| 503 | LLM provider unavailable (fallback exhausted) |
