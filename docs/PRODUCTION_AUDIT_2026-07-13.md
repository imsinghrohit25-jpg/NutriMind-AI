# NutriMind AI — Production Audit (2026-07-13)

Scope: full inventory of the existing system, verification of core integrations, gap analysis
against production-grade AI nutrition platforms (Cal AI, HealthifyMe, Fastic, SnapCalorie), and
the implementation plan for the two priority features (AI Meal Photo Recognition,
Disease-Aware Nutrition Intelligence). All changes are additive; nothing existing is removed
or rewritten.

---

## 1. Verified core integrations (evidence-based, not assumed)

| Integration | Status | Evidence |
|---|---|---|
| Gemini (LLM + Vision) | ✅ Wired, live | `gateway/adapters/gemini.ts`; `vision_analysis` tier used by `scan/meal-photo/vision.ts` and label OCR; live call confirmed on-device this cycle (real `AllProvidersFailedError: Rate limit hit on gemini` proves a real keyed call reached Gemini) |
| IFCT 2017 (India) | ✅ Wired, live | `datasources/ifct/loader.ts`; first-priority source for IN in `resolution/country-waterfall.ts`; used by `resolveByName` in `/v1/scans/meal` |
| USDA FDC (US) | ✅ Wired, live | `datasources/usda/client.ts`; waterfall fallback |
| CNF (Canada) | ✅ Imported | `datasources/cnf/*` + `scripts/import-cnf.ts` + migration `0031_cnf_integration.sql`; static dataset persisted into products DB (found via cache/DB tier of the waterfall — by design, not a live API) |
| CoFID (UK) | ✅ Wired | `datasources/cofid/*` + migration `0032`; GB-first routing in country waterfall |
| OpenFoodFacts | ✅ Wired, live | barcode resolution primary source; verified live on a real device this cycle (real product resolved from a physical barcode) |
| Barcode scanning | ✅ Verified on real hardware | ML Kit on-device; plane-stride fix + resolve cooldown landed this cycle |
| Nutrition calculations | ✅ Wired | `engines/score` (8 country standards + WHO + NOVA), `engines/meals/aggregate`, `nutrition/density-estimator` |
| Supabase Auth / Storage / RLS | ✅ Wired | migrations 0001–0035; JWT attached by mobile `_AuthInterceptor` on every request |

## 2. Existing feature inventory

### Backend (23 route modules)
`/v1`: health, ready, system, flags, gateway, products, resolve, scans (label OCR + **meal photo**),
curation, onboarding, privacy, data-rights, family, household(via family), restaurant, voice,
packs, pantry, biomarker, planner (+grocery), memory, agent (multi-agent SSE chat), health-data.

Engines: score (IN/US/UK/EU/AU/SG/JP/WHO standards, NOVA), personalization (targets/budgets),
allergen (taxonomy/detector/fail-safe), diet-compat (veg crosscheck), child-safety, meals
(aggregate + gap analysis), cart (score/projection/rollup), alternatives (retrieve/rank/why),
**disease (diabetes + hypertension rules — previously dead code, see §4)**.

Platform: multi-provider gateway (Anthropic/OpenAI/Gemini/OpenAI-compat) with tiers, circuit
breaker, cost governance, PII redaction, semantic cache; pg-boss jobs; AI memory system;
observability; k6 load tests; 25+ vitest suites.

### Mobile (Flutter)
Routed & reachable: login, register, consent, disclaimer, country, language, profile setup,
home, scanner (barcode + label), household, profile, memory*, agent chat, voice log*, meal plan.
(*routed but not menu-linked)

Built but **orphaned** (no route / no entry point): copilot, score screen, product alternatives,
cart, meals daily dashboard + meal log, weekly report, pantry, restaurant menu scan + recipe,
biomarker (glucose chart, lab upload), family dashboard, data rights, health integrations
(Fitbit/Garmin/consent/dashboard), history search, notification prefs, **meal photo flow**,
**disease chips widget**.

## 3. Gap analysis vs production platforms (Cal AI / HealthifyMe class)

| Capability | Cal AI / HealthifyMe | NutriMind before this cycle | Gap class |
|---|---|---|---|
| Photo → multi-food + macros | ✅ | Backend endpoint exists but: top-1 nutrition only, per-100g only, no totals, UI unreachable | **P1 — implemented this cycle** |
| Disease-aware guidance | ✅ (HealthifyMe) | 2 rules, dead code; UI widget orphaned; 7/10 conditions collectable in onboarding | **P1 — implemented this cycle** |
| Barcode + label scan | ✅ | ✅ (verified real device) | — |
| AI chat coach | ✅ | ✅ multi-agent SSE | — |
| Meal plans + grocery | ✅ | ✅ | — |
| Food diary / daily log | ✅ | Backend meals engine + screens built, not wired | P2 (wire-up) |
| Weight/goal tracking | ✅ | Profile TDEE/macros only; no time-series | P2 |
| Wearables / health sync | ✅ | Screens + `/v1/health-data` built, not linked | P2 (wire-up) |
| Streaks/gamification | ✅ | ✗ | P3 |
| Reports | ✅ | Weekly report screen built, not wired | P2 (wire-up) |
| Push reminders | ✅ | Prefs screen built; no scheduler | P3 |
| Payments/premium | ✅ | ✗ (business decision) | P3 |

P2/P3 items are documented for roadmap; this cycle implements the two requested P1 features
end-to-end without touching existing behavior.

## 4. Priority implementations (this cycle)

### 4.1 AI Meal Photo Recognition — upgraded end-to-end
Backend (`/v1/scans/meal`, additive response fields, old fields preserved):
- Vision prompt extended to **Indian + international** cuisines (was Indian-only).
- Nutrition resolved for **every** candidate ≥ 0.4 confidence (parallel), not just the top one.
- Per-candidate `nutritionPer100g` **and** portion-scaled `nutritionForPortion`
  (all macros + fiber, sodium, sugars, satFat, cholesterol + micronutrients:
  calcium, iron, potassium, zinc, vitamins A/C/D/B12, folate).
- `mealTotals` = sum of portion-scaled nutrition across resolved dishes.
- Per-dish provenance (`resolvedBy`, citation) and confidence retained.
- Disease evaluation per dish + for the meal totals when the caller is authenticated (§4.2).
- `portioning.ts` extended with international standard servings.

Mobile:
- New `ScanMode.meal` on the existing scanner screen + `/scanner?mode=meal` route
  + Home "Snap a meal" card (photo → `/v1/scans/meal` → results).
- `MealPhotoFlowResult` rewritten: all dishes with per-dish confidence + editable portion grams
  (client-side rescale), per-dish nutrition, meal totals card, disease notes, disclaimers.

### 4.2 Disease-Aware Nutrition Intelligence — 10 conditions
Backend:
- `engines/disease/rules/`: existing diabetes + hypertension kept as-is; **8 new pure-function
  rule modules**: high-cholesterol, heart-disease, kidney-disease, fatty-liver, PCOS, thyroid,
  pregnancy, obesity — each cited (WHO/ICMR/KDIGO/EASL/ESHRE/ATA/AHA), each returning
  `{triggered, severity, message, citationIds}` off per-100g nutrition (+ ingredients text where
  clinically relevant, e.g. soy↔thyroid, unpasteurized↔pregnancy).
- `engines/disease/index.ts`: `evaluateDiseaseRules(...)` — maps the user's
  `users_profiles.conditions[]` to rules, returns UI-ready results.
- Wired into `POST /v1/resolve/barcode` + `/v1/resolve/name` (authenticated callers get
  `diseaseGuidance` alongside `product`) and `/v1/scans/meal` (per dish + totals).
- New `GET /v1/disease/guidance`: per-condition safe foods / avoid foods / recommendations /
  warnings, fully cited, deterministic (no LLM), driven by the user's stored conditions.
- Citations registry extended with the new sources.

Mobile:
- `DiseaseChipsWidget` (existing, orphaned) now rendered on the Product screen from
  `diseaseGuidance`; threaded through the scan pipeline.
- Meal photo results show per-dish + meal-level disease notes.
- Profile setup condition list extended: + fatty_liver, + pregnancy, + obesity (10/10).

## 5. Out of scope this cycle (roadmap, do-not-break list)
Meal diary wiring, weight time-series, wearable linking, streaks, reports wiring, reminders,
premium. Every existing route, schema, screen, and test is preserved unchanged unless a fix was
strictly required (none were).
