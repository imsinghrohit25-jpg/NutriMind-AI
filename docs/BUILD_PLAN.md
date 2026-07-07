# NutriMind AI — Master Build Plan (Phase 0 deliverable)

**Version:** 1.0 · 2026-07-07 · Governs Phases 1–12 (Addendum Phases 13–19 outlined in § 8).
**Contract:** This plan implements every module (M1–M12), differentiator, and compliance item in
the NutriMind Enterprise Master Prompt. Strict phase gates; each phase ends with a Phase
Completion Report; every significant trade-off gets an ADR in `docs/adr/`.

---

## 1. Monorepo layout

```
nutrimind/
├── apps/
│   ├── mobile/                  # Flutter app (Android + iOS, tablet-responsive)
│   └── api/                     # TypeScript-strict Fastify service + pg-boss workers (one deployable, two entrypoints)
├── packages/
│   └── shared/                  # Source-of-truth API contracts: zod schemas → OpenAPI → generated Dart client
├── supabase/
│   ├── migrations/              # Versioned, additive SQL migrations (+ per-migration rollback/ & validate/ scripts)
│   ├── seed/                    # Canonical seeds: ingredient registry, allergen taxonomy, data_sources rows
│   └── tests/                   # RLS cross-user/cross-member negative tests (pgTAP + TS integration)
├── observability/               # docker-compose: OTEL Collector, Jaeger, Prometheus, Grafana (+ provisioned dashboards)
├── data/
│   ├── ifct2017/                # IFCT dataset drop point (gitignored; format docs committed)
│   └── knowledge/               # Curated corpus source docs (ICMR-NIN, WHO, FSSAI, EFSA/JECFA) + manifest.json
├── docs/
│   ├── adr/                     # ADR-NNNN-*.md
│   └── *.md                     # AUDIT, BUILD_PLAN, SETUP, SECURITY, COMPLIANCE, SCORING_METHODOLOGY, …
├── scripts/                     # repo-wide checks: secret scan, no-mock grep audit, score-determinism static check
└── .github/workflows/           # CI (lint/typecheck/test/build) + CD (Fastlane lanes)
```

Tooling: **npm workspaces** for TS packages; Flutter app stands alone under `apps/mobile`
(no melos needed for a single Flutter package — revisit if packages split). → ADR-0001.

## 2. Locked-in stack decisions (ADRs written when the phase lands)

| # | Decision | Choice (rationale summary) | ADR | Phase |
|---|---|---|---|---|
| 1 | Monorepo tooling | npm workspaces + standalone Flutter app | ADR-0001 | 1 |
| 2 | Backend framework | **Fastify** over Next.js API routes — long-lived workers, streaming SSE, OTEL maturity, no React coupling | ADR-0002 | 2 |
| 3 | Mobile state | **Riverpod** (mandated; no decisive alternative) | ADR-0003 | 4 |
| 4 | Local store | **Drift** over Isar — SQL relational fit for scan/product cache, SQLCipher encryption, stable maintenance | ADR-0004 | 4 |
| 5 | Jobs/queues | **pg-boss** on Supabase Postgres (mandated) — retry/backoff/DLQ config documented | ADR-0005 | 2 |
| 6 | AI gateway routing | Task-tier policy table (`parse_assist`, `vision_analysis`, `copilot_reasoning`, `report_generation`, `embeddings`) with fallback chains + circuit breaker | ADR-0006 | 2 |
| 7 | Barcode/OCR | ML Kit on-device first; cloud vision via gateway on low confidence | ADR-0007 | 4–5 |
| 8 | Cert pinning & root/jailbreak posture | decided with MASVS pass | ADR-0008/9 | 11 |
| 9 | Health Connect (not Google Fit REST — deprecated) | Addendum | ADR-0010 | 13 |

## 3. Cross-cutting invariants (enforced by code + CI, planned now)

- **Provenance:** every nutrition fact row carries `source`, `source_id`, `dataset_version`,
  `retrieved_at`, `license_class`. DB `CHECK`/NOT NULL from migration 0001.
- **Deterministic numbers:** health scores, allergen gates, diet rules, TDEE/macros = pure
  TS functions in `apps/api/src/engines/**`. CI static check (`scripts/audit-llm-writes.ts`)
  proves no LLM call path writes to score/nutrition fields.
- **LLM boundary:** LLMs identify/parse/explain only, always through the gateway; explanation
  output-policy checker (`apps/api/src/policy/output-policy.ts`) blocks diagnosis/cure language
  and score-contradicting explanations on every LLM-emitting surface.
- **Allergen hard gate:** `engines/allergen/` runs on every scan-result render path; UI renders
  member badges from its output only; no personalization input reaches it. Fail-safe on parse
  uncertainty.
- **Disclaimers:** shared `DisclaimerSurface` widget + backend `disclaimer_required` response
  flag; onboarding consent blocks until accepted.
- **No-mock policy:** CI grep audit (`scripts/audit-no-mock.sh`) fails the build on
  TODO/FIXME/mock/placeholder/fake outside `**/fixtures/**` and `**/test/**` fixture dirs.
- **Sensitive-data redaction:** OTEL/Sentry processors strip health-profile attributes; redaction
  test suite from Phase 2 onward.

## 4. Reuse-vs-new

Greenfield (see `docs/AUDIT.md`): **all application code is new**. Reused assets: developer
environment (audited green), public real-data APIs (OpenFoodFacts, USDA FDC), licensed dataset
(IFCT 2017), curated public regulatory corpus, and mature OSS libraries (Fastify, zod, pg-boss,
Riverpod, Drift, ML Kit, OTEL SDKs) — each pinned and dependency-audited in Phase 11.

## 5. Phase-by-phase file plan (Phases 1–12)

> Format: key files/dirs per phase (representative, not exhaustive at leaf level), the modules
> (M1–M12) each phase advances, and the phase's exit gate. Acceptance criteria are as written in
> the Master Prompt; they are restated in each Phase Completion Report and checked one by one.

### Phase 1 — Database schema & migrations
**Modules grounded:** all (data layer). **Differentiators:** provenance discipline, household model (D2).
```
supabase/config.toml
supabase/migrations/0001_extensions.sql            # pgcrypto, pgvector, pg_trgm
supabase/migrations/0002_identity.sql              # users_profiles, household_members, user_consents
supabase/migrations/0003_catalog.sql               # products, product_nutrition, product_ingredients,
                                                   # ingredients, data_sources (provenance NOT NULLs)
supabase/migrations/0004_scanning.sql              # scans, scan_images
supabase/migrations/0005_intelligence.sql          # health_scores (algorithm_version + input_snapshot),
                                                   # ingredient_assessments, member_safety_evaluations
supabase/migrations/0006_meals_carts_reports.sql   # meal_logs, grocery_cart_sessions(+items), weekly_reports
supabase/migrations/0007_reco_copilot.sql          # recommendations, copilot_conversations(+messages)
supabase/migrations/0008_knowledge_vectors.sql     # knowledge_documents, knowledge_chunks(+embeddings),
                                                   # product_embeddings, user_history_embeddings,
                                                   # match_* SQL functions w/ mandatory scope params
supabase/migrations/0009_ops.sql                   # pgboss schema, llm_call_log, audit_log, feature_flags,
                                                   # curation_queue
supabase/migrations/0010_rls.sql                   # RLS all user-owned tables; public-read canonical classes
supabase/migrations/rollback/*.sql                 # per-migration rollback
supabase/migrations/validate/*.sql                 # per-migration validation
supabase/seed/{data_sources,allergen_taxonomy,ingredient_registry}.sql
supabase/tests/rls_cross_user.test.ts              # + existing-data-preservation migration test
docs/adr/ADR-0001-monorepo.md
```
**Gate:** clean apply to fresh + seeded DB; RLS negative tests pass; barcode-lookup and
vector-match functions correct on real inserted rows; validation scripts green.

### Phase 2 — Backend foundation
**Modules grounded:** gateway for M1/M3/M8/M10/M11; jobs for M10.
```
apps/api/src/server.ts, app.ts                     # Fastify, security headers, versioned /v1 routes
apps/api/src/plugins/{auth.ts,rbac.ts,rate-limit.ts,otel.ts,error-handler.ts}
apps/api/src/gateway/{provider.ts,router.ts,catalog.ts,circuit-breaker.ts,cost-log.ts,cache.ts,errors.ts}
apps/api/src/gateway/adapters/{anthropic.ts,openai.ts,gemini.ts,openai-compat.ts}
apps/api/src/jobs/{boss.ts,registry.ts,idempotency.ts}   # retry/backoff/DLQ conventions
apps/api/src/policy/output-policy.ts               # forbidden-language + contradiction checks (skeleton grows per phase)
apps/api/src/telemetry/{otel.ts,redaction.ts}
packages/shared/src/{schemas/**,openapi.ts}        # zod envelopes → OpenAPI
observability/docker-compose.yml + collector/, grafana/dashboards/
scripts/{secret-scan.sh,audit-no-mock.sh}
docs/adr/ADR-0002-fastify.md … ADR-0006-routing.md, docs/SETUP.md (v1)
```
**Gate:** real prompt through **each** adapter; routing proven via `llm_call_log`; one unbroken
OTEL trace API→queue→worker; rate limits enforced in tests; secret scan clean.

### Phase 3 — Real food data layer
**Modules:** M1 resolution core, M11 embeddings. **Differentiators:** D1 India-first data, D4 honesty.
```
apps/api/src/datasources/openfoodfacts/{client.ts,normalize.ts,cache.ts,attribution.ts}
apps/api/src/datasources/usda/{client.ts,normalize.ts}
apps/api/src/datasources/ifct/{parser.ts,loader.ts,format.md}      # full pipeline; file may be pending
apps/api/src/resolution/waterfall.ts               # barcode → cache → OFF → IFCT → USDA → not-found→curation
apps/api/src/nutrition/{canonical-model.ts,units.ts,derived.ts}    # added-sugar estimation rules documented
apps/api/src/embeddings/product-pipeline.ts
apps/api/src/routes/v1/{products.ts,resolve.ts,curation.ts}
docs/DATA_SOURCES.md (finalized), docs/adr/ADR-*-added-sugar-estimation.md
```
**Gate:** 10 real Indian barcodes resolve with provenance; real IFCT food returns IFCT values;
cache-hit path verified; not-found → curation entry; zero hardcoded nutrition (grep + audit).

### Phase 4 — Flutter app foundation
**Modules:** app shell for everything; M1 capture; offline-first differentiator D6.
```
apps/mobile/lib/core/{design_system/**,router/**,network/api_client.dart,telemetry/**}
apps/mobile/lib/core/offline/{local_db.dart(Drift),scan_queue.dart,sync_engine.dart,connectivity.dart}
apps/mobile/lib/features/auth/**, onboarding/** (consent + disclaimer gates), profile/** (TDEE/macros + "how we calculated")
apps/mobile/lib/features/scanner/{camera_service.dart,barcode_mlkit.dart,ocr_mlkit.dart,pipeline.dart}
apps/mobile/lib/features/household/**               # member profiles: age, allergies, conditions
apps/mobile/integration_test/{airplane_mode_sync_test.dart,…}
packages/shared → generated Dart client wiring
docs/adr/ADR-0003-riverpod.md, ADR-0004-drift.md, ADR-0007-ocr-strategy.md
```
**Gate:** runs on real Android + iOS devices; offline barcode scan vs local cache; airplane-mode
sync test green; image compression verified; consent/disclaimer blocking.

### Phase 5 — Scan pipelines end-to-end (M1)
```
apps/api/src/routes/v1/scans.ts, apps/api/src/scan/{label-parser/**,ingredient-parser/**,
  parse-assist.ts (disambiguation ONLY), meal-photo/{vision.ts,portioning.ts}, cart-session.ts}
apps/mobile/lib/features/scanner/flows/{barcode_flow,label_flow(+per-field confidence confirm UI),
  meal_photo_flow(confidence + editable portions), cart_scan_flow}/**
apps/mobile/lib/features/product/** (nutrition + provenance display)
perf harness: docs/PERFORMANCE.md (v1: scan latency measurements)
```
**Gate:** real Indian label → confirmable structured nutrition w/ per-field confidence; real meal
photo → dish match + visible confidence + IFCT/USDA-traceable nutrition; on-device OCR <2s;
blurry label triggers low-confidence flow.

### Phase 6 — Health Score Engine + Ingredient Intelligence (M2, M3)
```
apps/api/src/engines/score/{engine.ts,subscores/*.ts,nova.ts,thresholds.ts,version.ts}   # pure functions
apps/api/src/engines/score/__tests__/**            # exhaustive boundary + determinism suites
apps/api/src/explain/{explainer.ts}                # LLM explanation; policy-checked vs computed numbers
apps/mobile/lib/features/score/** (full expandable math UI), features/ingredients/** (per-ingredient cards)
supabase/seed/additives_ins_fssai.sql              # knowledge-linked additive records
docs/SCORING_METHODOLOGY.md                        # versioned, ICMR-NIN-adapted thresholds + citations
```
**Gate:** boundary tests per sub-score; determinism test; complete-math UI on real product;
INS 211 shows cited safety info; contradiction-blocking demonstrated.

### Phase 7 — Personalization & safety intelligence (M4, M5, M6 + core)
```
apps/api/src/engines/{personalization/{targets.ts(Mifflin-St Jeor),budgets.ts},
  allergen/{taxonomy.ts,detector.ts,fail-safe.ts}, disease/{rules/*.ts,citations.ts},
  diet-compat/{rules/*.ts,veg-mark-crosscheck.ts}, child-safety/{engine.ts}}
apps/mobile/lib/features/{safety_badges/**,disease_chips/**,child_mode/**}
docs/SCORING_METHODOLOGY.md addendum (child safety), docs/ALLERGEN_TAXONOMY.md
```
**Gate:** unsuppressible per-member peanut warning on real "may contain" product; fail-safe on
ambiguous parse (negative test); cited hypertension guidance on real high-sodium product;
veg-mark mismatch flagged; remaining-budget math correct.

### Phase 8 — Knowledge base (RAG) + Health Copilot (M8)
```
apps/api/src/knowledge/{ingest/{chunker.ts,embedder.ts,versioning.ts},retrieval/hybrid.ts}
apps/api/src/copilot/{orchestrator.ts,grounding-verifier.ts,guardrails.ts,streaming.ts,memory.ts}
apps/mobile/lib/features/copilot/** (streaming chat, tappable citations, disclaimer surface)
data/knowledge/manifest.json (corpus inventory + versions)
docs/COPILOT_EVAL.md + apps/api/src/copilot/__eval__/**
```
**Gate:** product-specific cited diabetes answer; fabricated-claim caught by verifier;
medication question → refusal+redirect; retrieval spot-check vs documented eval set.

### Phase 9 — Meal Intelligence + Grocery Cart AI (M7, M9)
```
apps/api/src/engines/{meals/{aggregate.ts,gap-analysis.ts},cart/{score.ts,projection.ts,rollup.ts}}
apps/mobile/lib/features/{meals/** (log paths, daily dashboard), cart/** (session UX, expandable math)}
docs/CART_METHODOLOGY.md
```
**Gate:** hand-verified day aggregation; real 8-item cart with expandable correct math; family
rollup surfaces Phase-7 allergen conflict.

### Phase 10 — Alternatives + Weekly reports + Notifications + Memory (M10, M11, M12)
```
apps/api/src/engines/alternatives/{retrieve.ts,rank.ts(delta),filters.ts(availability+budget),why.ts}
apps/api/src/jobs/handlers/weekly-report.ts + report renderer; push/{fcm.ts,apns.ts,preferences.ts}
apps/api/src/memory/{history-embeddings.ts,semantic-search.ts,signals.ts}
apps/mobile/lib/features/{alternatives/**,reports/**,history_search/**,notification_prefs/**}
```
**Gate:** real alternatives w/ delta math + budget option (or honest thin-category); scheduled
job → real push on device; history semantic search works; cross-user RLS negative test.

### Phase 11 — i18n, performance & security hardening
```
apps/mobile/lib/l10n/{app_en.arb,app_hi.arb,app_mr.arb} + backend content negotiation + LLM output-language routing
Devanagari OCR verification in label pipeline; docs/LOCALIZATION.md (food-name strategy)
k6/ load tests → docs/PERFORMANCE.md (device matrix + p50 evidence)
MASVS checklist → docs/SECURITY.md; secure storage, screenshot protection on health screens,
  prompt-injection hardening (all user text → LLM), dependency audit
apps/api/src/routes/v1/data-rights.ts + mobile flows  # full export + full deletion, e2e-tested
docs/adr/ADR-0008-cert-pinning.md, ADR-0009-root-jailbreak.md
```
**Gate:** Hindi UI+Copilot on device; Devanagari OCR test; measured perf evidence committed;
MASVS items verified; deletion proven by verification query; injection strings inert.

### Phase 12 — Testing, CI/CD, store readiness & documentation
```
.github/workflows/{ci.yml,cd.yml}; apps/mobile/fastlane/** (AAB + iOS lanes, staged rollout)
Test completion: E2E happy paths, chaos (provider outage→fallback, worker kill→recovery), load
docs/{ARCHITECTURE.md,SETUP.md(final),OPERATIONS.md,API.md,RELEASE.md,COMPLIANCE.md}
Store assets: data-safety / privacy-nutrition-label content, health-policy declarations
docs/DELIVERY_REPORT.md                            # Final Verification Protocol items 1–8
```
**Gate:** full CI green incl. emulator integration tests; release builds both platforms;
SETUP.md-only bring-up; store checklists complete; final no-mock grep clean.

## 6. Module & differentiator coverage map

| Item | Phases | Item | Phases |
|---|---|---|---|
| M1 Scanner | 3,4,5 | M8 Copilot | 2,8 |
| M2 Score Engine | 6 | M9 Meals | 9 |
| M3 Ingredients | 3,6 | M10 Reports | 10 |
| M4 Disease | 7 | M11 Alternatives | 3,10 |
| M5 Diet/Goal | 7 | M12 Memory | 1,10 |
| M6 Child Safety | 7 | Personalized Core | 4,7 (every module consumes) |
| M7 Cart | 5,9 | Compliance/Medical | every phase; audited 11–12 |
| D1 India-first | 3,5,6,11 | D5 Swap+India reality | 10 |
| D2 Family Guardian | 1,7,9 | D6 Offline-first | 4,5 |
| D3 Glass-box score | 6 | D7 Honest habit loop | 10 |
| D4 Honest uncertainty | 5,7,8,10 | | |

## 7. Risk register

| ID | Risk | L×I | Mitigation |
|---|---|---|---|
| R-01 | **IFCT 2017 acquisition/licensing** — dataset is licensed (ICMR-NIN); file may take weeks | H×H | Build full ingestion pipeline against documented format in Phase 3; waterfall degrades gracefully to OFF/USDA; precise blocker raised at Phase 3 gate |
| R-02 | **OCR accuracy on Indian labels** (fonts, layouts, Devanagari, per-serving vs per-100g) | H×H | On-device→cloud fallback; per-field confidence + mandatory confirm UI; label fixture corpus grown from real products; Devanagari gate in Phase 11 |
| R-03 | **Portion-estimation honesty** for cooked meals | M×H | Explicit confidence + editable portions; IFCT household measures; never LLM-invented values; honest-uncertainty UX is a differentiator, not a patch |
| R-04 | OneDrive + space-in-path breaks builds | H×M | Relocate repo to `C:\dev\nutrimind` before Phase 1 (decision requested in Phase 0 report) |
| R-05 | OpenFoodFacts India coverage gaps / rate limits | M×M | Respectful caching + TTL, bulk-export option, curation queue turns gaps into data |
| R-06 | LLM cost blowout | M×M | Task-tier routing (cheap models for parse-assist), prompt caching, per-call cost log + Grafana budget dashboard |
| R-07 | Store health-policy review friction | M×H | docs/COMPLIANCE.md checklist from Phase 0 mindset; disclaimers/consent baked in Phases 4–8 |
| R-08 | iOS build requires macOS | H×M | CI macOS runners + Fastlane (Phase 12); development against Android device/emulator until then |
| R-09 | Household RLS complexity (intra-household privacy) | M×H | RLS designed in Phase 1 with negative tests; addendum Phase 19 extends, doesn't rewrite |
| R-10 | Knowledge-corpus licensing/versioning drift | L×M | `data/knowledge/manifest.json` versions every document; citations pin document version |

## 8. Addendum outlook (Phases 13–19)

Schema and interfaces in Phases 1–2 are designed so the addendum lands additively:
`health_metrics`, `lab_results`, `glucose_readings` (partitioned), `pantry_items`,
`receipts` arrive as new migrations; `HealthDataProvider`, `GlucoseProvider`, STT/TTS engines
plug into the existing gateway/adapter pattern; the Phase 17 plan validator reuses the Phase 6/7
deterministic engines. Addendum credentials (Fitbit, Garmin, Dexcom sandbox) are already listed
in `.env.example` under a clearly-marked ADDENDUM section. Detailed file-by-file plans for 13–19
are produced at the Phase 12→13 boundary, informed by what shipped.

## 9. Blockers & acquisition checklist

See `.env.example` (every credential/config, annotated with which phase first needs it) and
`docs/DATA_SOURCES.md` (acquisition steps, OpenFoodFacts etiquette/caching plan, IFCT licensing
path, knowledge-corpus inventory). **Nothing blocks Phases 0–1.** First credential needs:
Phase 2 (≥1 LLM provider key to prove adapters; all four to pass the gate), Phase 3 (USDA key —
free/instant; IFCT dataset file — licensed, start acquisition NOW per R-01).
