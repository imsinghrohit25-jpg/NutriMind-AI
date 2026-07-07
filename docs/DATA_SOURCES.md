# NutriMind AI — Data Source Acquisition Checklist (Phase 0)

The **only permitted nutrition sources** (Master Prompt § System Context). Every fact row
carries provenance: `source`, `source_id`, `dataset_version`, `retrieved_at`, `license_class`.
Registry table: `data_sources` (Phase 1, seeded).

---

## 1. OpenFoodFacts (OFF) — packaged products + barcodes

| | |
|---|---|
| Access | Public API, **no key required** — usable immediately (Phase 3) |
| Endpoints | Product by barcode: `GET /api/v2/product/{barcode}.json`; search: `/api/v2/search`; India subset via `countries_tags=en:india` filter and/or `in.openfoodfacts.org` |
| License | Database: **ODbL 1.0** · contents: DbCL · images: CC-BY-SA — attribution **mandatory** in-app ("Product data from OpenFoodFacts, ODbL") + share-alike obligations documented in `datasources/openfoodfacts/attribution.ts` |
| **Etiquette plan** (mandated) | 1) Descriptive `User-Agent` (`OFF_USER_AGENT` — app name/version/contact); 2) stay well under published limits (~100 req/min product reads, 10 req/min search) via client-side throttle; 3) **cache-first**: every fetched product persists into our canonical tables with `retrieved_at`, TTL revalidation (`OFF_CACHE_TTL_HOURS`, default 7 days) — second lookup never re-hits OFF (Phase 3 acceptance test); 4) nightly **bulk export / Parquet dump** ingestion for the India subset instead of crawling; 5) write-back: user-submitted product photos/data contributed upstream where consented (good citizenship, post-v1) |
| Action | ☐ None to unblock. ☐ Set real contact email in `OFF_USER_AGENT`. ☐ Decide India-subset bulk import cadence at Phase 3 start |

## 2. USDA FoodData Central (FDC) — reference nutrition

| | |
|---|---|
| Access | Real REST API, **free key, instant issuance**: https://fdc.nal.usda.gov/api-key-signup |
| Endpoints | `GET /v1/food/{fdcId}`, `POST /v1/foods/search` (Foundation, SR Legacy data types preferred for whole foods) |
| Limits | 1,000 req/hour/key (api.data.gov default) — cache-first discipline same as OFF |
| License | US Government work — public domain (CC0); attribution given as good practice |
| Action | ☐ **Sign up for key before Phase 3** (5 minutes) → `USDA_FDC_API_KEY` |

## 3. IFCT 2017 (ICMR-NIN Indian Food Composition Tables) — ⚠ RISK R-01, START NOW

| | |
|---|---|
| What | Authoritative Indian dataset: 528 foods × ~150 nutrients, regional names, household measures. **First-class source for Indian whole foods/dishes** (dal, sabzi, regional dishes) |
| Access | **No public API — licensed publication** of ICMR-National Institute of Nutrition, Hyderabad. Acquisition: purchase/licence the IFCT 2017 book + data tables via NIN (https://www.nin.res.in) / authorized channels; record licence terms in `data_sources` (`license_class=licensed`) |
| Our obligation | Phase 3 implements the **complete** parser+loader pipeline against the documented table format (`data/ifct2017/`, `datasources/ifct/format.md`) and tests it on the documented format. If the file is absent at the Phase 3 gate → **precise blocker raised, phase stops** — per Master Prompt, never faked |
| Action | ☐ **User action, start immediately (lead time!):** obtain IFCT 2017 data file/tables + licence confirmation → drop into `data/ifct2017/` (gitignored) |

## 4. Curated regulatory/scientific knowledge base (RAG corpus, Phase 8; cited from Phase 6)

Versioned documents → `data/knowledge/` + `manifest.json` (doc, version, URL, retrieved date,
license) → chunked/embedded into `knowledge_documents`/`knowledge_chunks`.

| Document | Publisher / access | Grounds |
|---|---|---|
| Dietary Guidelines for Indians (2024 revision) | ICMR-NIN — free public PDF | scoring thresholds, disease & diet guidance, meal-plan templates |
| WHO guideline: free sugars intake | WHO — free public | sugar sub-score, child sugar limits (M6) |
| WHO guideline: sodium intake | WHO — free public | sodium sub-score, hypertension layer (M4) |
| WHO: trans-fat elimination (REPLACE) | WHO — free public | fat-quality sub-score |
| FSSAI Food Safety (Labelling & Display) Regulations 2020 | FSSAI — free public | label parsing rules, veg/non-veg mark, FSSAI licence number |
| FSSAI Food Products Standards & Additives Regulations | FSSAI — free public | permitted additives, INS numbers (M3) |
| EFSA / JECFA additive evaluations (per-additive) | EFSA Journal / WHO JECFA — free public | ingredient safety ratings + citations (M3) |

Action: ☐ Download corpus at Phase 8 start (all free); ☐ record versions in `manifest.json`.

## 5. Explicitly NOT sources (honesty boundary)

- **No "FSSAI nutrition API"** — FSSAI publishes regulations, not a nutrition API. Any such
  integration would be fabricated and is prohibited.
- **No scraped retailer accounts, no live market-price APIs** (addendum: prices come from
  user receipts/entries only), **no reverse-engineered CGM endpoints** (addendum § S).
- **No LLM-generated nutrition values, ever** — models identify/parse; the database quantifies.

## 6. Credential/dataset timeline

| Needed by | Item | Status |
|---|---|---|
| Phase 2 | ≥1 LLM key to develop; Anthropic + OpenAI + Gemini keys to pass the 4-adapter gate (OpenAI-compat can point at local Ollama) | ☐ user |
| Phase 3 | USDA FDC key (instant) | ☐ user |
| Phase 3 gate | IFCT 2017 dataset file (licensed — lead time) | ☐ user, **start now** |
| Phase 8 | Knowledge corpus (free downloads) | ☐ agent |
| Phase 10 | Firebase project (FCM) + Apple Developer account (APNs) | ☐ user |
| Phase 12 | Play Console + App Store Connect accounts, signing assets | ☐ user |
| Phase 13–14 (addendum) | Fitbit dev app, Garmin Health program, Dexcom sandbox | ☐ user, apply early |
