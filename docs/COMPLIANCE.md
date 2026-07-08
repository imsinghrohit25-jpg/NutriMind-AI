# NutriMind AI — Compliance Checklist

## Regulatory Framework

| Regulation | Applicability | Status |
|------------|---------------|--------|
| FSSAI Labelling Regulations 2022 | Nutrition facts, allergen disclosures | ✅ Thresholds in `thresholds.ts`; allergen taxonomy in `taxonomy.ts` |
| FSSAI Allergens Regulations 2023 | 14 mandatory allergen categories | ✅ All 14 implemented + Indian terms |
| ICMR-NIN RDA 2020 | Nutrient reference values for India | ✅ Used as primary RDA source in score engine |
| WHO 2023 (Sodium, Sugar, Trans-fat) | Daily limits for at-risk nutrients | ✅ In `thresholds.ts` |
| WHO 2021 (Hypertension) | Sodium guidance for hypertension | ✅ `disease/rules/hypertension.ts` |
| AHA 2016 (Child sugar) | Sugar limits for children under 12 | ✅ `child-safety/engine.ts` |
| Digital Personal Data Protection Act 2023 | Indian privacy law | ✅ Data rights export + deletion; consent screens |
| GDPR (EU users) | Privacy rights | ✅ Same data rights pipeline; EU-compatible |
| MASVS v2.1.0 | Mobile security | ✅ `docs/SECURITY.md` checklist |

## Health Disclaimer Implementation

Every health-related output in the app includes a non-dismissible disclaimer:

- Score screen: *"For informational purposes only. Not a substitute for professional nutritional advice."*
- Copilot: `_DisclaimerBar` always visible above input; LLM system prompt includes disclaimer instruction
- Disease chips: Per-chip disclaimer with citation
- Weekly report: Footer disclaimer

## AI / LLM Policy

**LLM must not:**
- Diagnose medical conditions
- Recommend medications or supplements
- Prescribe treatment plans
- Generate or modify health scores (deterministic engine only)

**Guardrail categories** (blocked before LLM call):
- `emergency` → redirect to 112
- `medication` → redirect to doctor
- `diagnosis` → redirect to doctor
- `treatment` → redirect to doctor
- `supplement_dose` → redirect to dietitian
- (general health questions → allowed through)

**Grounding verifier:** numeric claims cross-checked against retrieved knowledge chunks. >30% ungrounded → fabrication flag added to response metadata.

## Score Engine Audit Trail

Every health score stored in `health_scores` includes:
- `algorithm_version: "1.0.0"` — version of `SCORE_ALGORITHM_VERSION`
- `inputs: NutritionInput` — exact inputs used for computation
- `sub_scores: SubScores` — per-nutrient breakdown
- `computed_at: timestamptz`

This allows retrospective verification that any score is correctly computed from the documented methodology (`docs/SCORING_METHODOLOGY.md`).

## Data Handling

| Data type | Storage | Retention | Deletion |
|-----------|---------|-----------|----------|
| Scan history | Supabase (RLS) | 365 days | Hard delete on account deletion |
| Meal logs | Supabase (RLS) | 365 days | Hard delete on account deletion |
| Allergen profile | Supabase (RLS) | Until deletion | Hard delete on account deletion |
| Copilot messages | In-memory (MAX_TURNS=10) | Session only | Never persisted to DB |
| Push tokens | Supabase (RLS) | Until deletion | Hard delete on account deletion |
| Knowledge corpus | Supabase (shared, no PII) | Until corpus update | N/A |

## Store Policy Declarations

### Google Play Data Safety
| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Health and fitness | Yes | No | Score computation, personalisation |
| Location | No | — | — |
| App activity | Yes | No | Scan history, analytics |
| Device / other IDs | Yes | No | Push notifications |

**Data encryption in transit:** Yes (TLS 1.2+)  
**User deletion request honored:** Yes (in-app data rights screen)

### Apple Privacy Nutrition Label
| Category | Used |
|----------|------|
| Health & Fitness | Nutrition data for personalisation |
| Identifiers | User ID for auth |
| Usage Data | Scan frequency (analytics) |

**No third-party tracking.** No advertising networks integrated.
