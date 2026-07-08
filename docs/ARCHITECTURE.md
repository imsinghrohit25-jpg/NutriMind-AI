# NutriMind AI — Architecture Overview

## System Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│  Flutter Mobile App (iOS + Android)                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Scanner  │ │  Score   │ │ Copilot  │ │  Meals   │ │   Cart   │  │
│  │ (MLKit)  │ │ Engine   │ │  Screen  │ │Dashboard │ │ Rollup   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │             │            │              │             │         │
│  ┌────▼─────────────▼────────────▼──────────────▼─────────────▼────┐  │
│  │  Riverpod providers + Go Router                                  │  │
│  │  Drift (local SQLite) — offline-first queue                      │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │ HTTPS (TLS 1.2+, cert pinned)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Fastify API (apps/api)                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ /resolve │ │ /score   │ │ /copilot │ │ /meals   │ │ /cart    │  │
│  │ barcode  │ │ engine   │ │ (SSE)    │ │ /gaps    │ │ /rollup  │  │
│  └────┬─────┘ └──────────┘ └────┬─────┘ └──────────┘ └──────────┘  │
│       │ LLM Gateway (circuit-breaker + tier routing)                  │
│       │  ┌────────────────────────────────────────────────────────┐   │
│       │  │ parse_assist │ vision_analysis │ copilot_reasoning     │   │
│       │  │ report_generation │ embeddings                         │   │
│       │  └────────────────────────────────────────────────────────┘   │
│       │                                                                 │
│  ┌────▼──────────────────────────────────────────────────────────────┐ │
│  │  pg-boss job queue (weekly-report, embed-product, embed-knowledge) │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Supabase (managed Postgres + Auth + Realtime + Storage)              │
│  Tables: products, health_scores, scan_history, meal_logs,            │
│          household_members, knowledge_chunks, scan_history_embeddings  │
│  pgvector: knowledge_chunks.embedding (1536d), scan_history_embeddings │
│  RLS: every table scoped to auth.uid() = user_id                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

| Decision | ADR | Rationale |
|----------|-----|-----------|
| Monorepo | ADR-0001 | Single source of truth; shared TS types across API |
| Fastify API | ADR-0002 | Low-latency, plugin ecosystem, TypeScript-native |
| Riverpod | ADR-0003 | Compile-time safe, testable, no BuildContext dependency |
| Drift | ADR-0004 | Type-safe SQLite, offline-first, reactive streams |
| pg-boss | ADR-0005 | Reliable job queue on existing Postgres; no Redis |
| LLM routing | ADR-0006 | Task-tier routing keeps cost predictable |
| Added-sugar estimation | ADR-0007 | Label value preferred; total sugars fallback (estimated=true) |
| OCR strategy | ADR-0008 | On-device ML Kit first; server LLM parse-assist if confidence < 0.7 |
| Cert pinning | ADR-0009 | SPKI hash pinning; backup pin; 30-day rotation window |
| Root detection | ADR-0010 | Warn-not-block; flutter_jailbreak_detection |

## Score Engine Invariants

- **Deterministic**: identical inputs → identical outputs (verified by 49 CI tests)
- **No LLM in score path**: `engine.ts` has no gateway import; enforced by CI grep gate
- **Versioned**: `SCORE_ALGORITHM_VERSION = '1.0.0'` stored in `health_scores.algorithm_version`
- **Weights**: Sodium 20%, Sugar 20%, Sat fat 15%, Trans fat 10%, Fibre 15%, Protein 10%, NOVA 10%
- **Thresholds**: ICMR-NIN RDA 2020, WHO 2023, FSSAI Labelling Regulations 2022

## Data Flow — Barcode Scan (Online)

```
1. MLKit barcode → barcode string (< 500ms, on-device)
2. Drift enqueue → scan_queue (< 50ms, never lost)
3. GET /api/v1/resolve/:barcode → waterfall: cache → OpenFoodFacts → USDA → LLM assist
4. computeHealthScore(nutrition) → score + sub-scores (pure function, < 1ms)
5. detectAllergens(ingredients, profile) → allergen matches (pure, < 1ms)
6. Supabase INSERT health_scores, scan_history
7. embedScanHistory(scan, gateway) → scan_history_embeddings (async)
8. SSE stream: score + allergens + NOVA + explanations
```

## RAG Copilot Pipeline

```
Query → sanitiseForLLM() → checkGuardrails()
  → if blocked: 422 with guardrail message
  → else: hybrid retrieval (BM25 + vector RRF_K=60, topK=5)
  → buildPrompt(chunks, productContext, memoryHistory)
  → gateway.complete(tier: copilot_reasoning) → SSE stream
  → verifyGrounding(answer, chunks) → flag if >30% ungrounded
  → send citations in final SSE event
```

## Offline-First Architecture

```
Device offline                    Device online
───────────────────────           ────────────────────────────
Drift scan_queue (SQLite)         Sync worker (connectivity_plus)
  ↓ local cache lookup              ↓ flush queue to API
  ↓ offline banner in UI            ↓ merge with remote state
  ↓ allergen check still runs       ↓ realtime subscription
  (from local allergen taxonomy)
```

## Module Map

| Module | Location | Phase |
|--------|----------|-------|
| Scanner (barcode + OCR) | `apps/mobile/lib/features/scanner/` | 3,4,5 |
| Score Engine | `apps/api/src/engines/score/` | 6 |
| Allergen Detector | `apps/api/src/engines/allergen/` | 7 |
| Disease Rules | `apps/api/src/engines/disease/` | 7 |
| Diet Compatibility | `apps/api/src/engines/diet-compat/` | 7 |
| Child Safety | `apps/api/src/engines/child-safety/` | 7 |
| RAG Knowledge Ingest | `apps/api/src/knowledge/` | 8 |
| Copilot | `apps/api/src/copilot/` | 8 |
| Meal Intelligence | `apps/api/src/engines/meals/` | 9 |
| Cart AI | `apps/api/src/engines/cart/` | 9 |
| Alternatives | `apps/api/src/engines/alternatives/` | 10 |
| Notifications / Reports | `apps/api/src/push/`, `src/jobs/` | 10 |
| Memory / History | `apps/api/src/memory/` | 10 |
| i18n | `apps/mobile/lib/l10n/`, `apps/api/src/i18n/` | 11 |
| Security | `apps/api/src/security/` | 11 |
| Data Rights | `apps/api/src/routes/v1/data-rights.ts` | 11 |
