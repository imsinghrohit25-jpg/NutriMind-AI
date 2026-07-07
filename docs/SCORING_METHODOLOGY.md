# NutriMind AI — Health Score Methodology

**Algorithm version:** 1.0.0  
**Effective:** 2026-07-07  
**Regulatory basis:** ICMR-NIN Recommended Dietary Allowances 2020; WHO 2023; FSSAI Food Safety and Standards (Labelling and Display) Regulations 2022; NOVA Classification (Monteiro et al. 2019)

---

## 1. Overview

The NutriMind health score is a **0–100 composite** computed entirely from deterministic, rule-based functions in `apps/api/src/engines/score/`. No language model (LLM) contributes to the score value. The score is reproducible: identical inputs always produce identical outputs.

The score is designed for the **Indian dietary context**:
- Sodium and sugar carry elevated weights because hypertension and type-2 diabetes prevalence in India is among the highest globally (ICMR-NIN 2020).
- NOVA group penalisation reflects the rapid growth of ultra-processed food consumption in Indian urban markets.
- Fibre weighting is elevated because Indian urban diets are frequently fibre-deficient.

---

## 2. Sub-scores

Each sub-score is 0–100. A higher sub-score is always better (sodium sub-score = 100 means no sodium; fibre sub-score = 100 means very high fibre). All values are per 100g of product.

### 2.1 Sodium (weight: 20%)

| Range (mg/100g) | Level | Sub-score |
|---|---|---|
| ≤ 90 | Very low | 100 |
| 90–120 | Low | ~85 |
| 120–360 | Moderate | 85 → 50 (linear) |
| 360–600 | High | 50 → 20 (linear) |
| 600–900 | Very high | 20 → 0 (linear) |
| > 900 | Very high | 0 |

Source: WHO Salt Reduction Guideline (<2000 mg Na/day). FSSAI "high sodium" = 600 mg/100g.

### 2.2 Sugar (weight: 20%)

Uses **added sugar** (from label) when available. Falls back to total sugars as an upper-bound proxy when added sugar is absent (ADR-0007). The `isEstimated` flag is exposed to users.

| Range (g/100g) | Level | Sub-score |
|---|---|---|
| ≤ 4.5 | Very low | 100 |
| 4.5–9 | Low | 85 → 70 |
| 9–15 | Moderate | 70 → 45 |
| 15–22.5 | High | 45 → 20 |
| 22.5–40 | Very high | 20 → 0 |
| > 40 | Very high | 0 |

Source: WHO Free Sugars Guideline 2015 (< 10% energy = < 50g/day for 2000 kcal). FSSAI "high sugar" = 15g/100g.

### 2.3 Saturated fat (weight: 15%)

| Range (g/100g) | Level | Sub-score |
|---|---|---|
| ≤ 1.0 | Very low | 100 |
| 1–2.5 | Low | 85 → 65 |
| 2.5–5.0 | Moderate | 65 → 40 |
| 5–7.5 | High | 40 → 15 |
| 7.5–10 | Very high | 15 → 0 |
| > 10 | Very high | 0 |

Source: ICMR-NIN 2020 (< 10% of energy from saturated fat). FSSAI "high saturated fat" = 5g/100g.

### 2.4 Trans fat (weight: 10%)

| Range (g/100g) | Level | Sub-score |
|---|---|---|
| 0 | None | 100 |
| 0–0.5 | Trace | 80 |
| 0.5–1.0 | Present | 50 |
| > 1.0 | High | 50 → 0 (linear) |

Source: WHO Global Target to Eliminate Trans Fats by 2023. FSSAI PHVO regulations.

### 2.5 Dietary fibre (weight: 15%)

| Range (g/100g) | Level | Sub-score |
|---|---|---|
| 0 | None | 0 |
| 0–0.9 | Low | 0 → 20 |
| 0.9–3 | Moderate | 20 → 50 |
| 3–6 | High | 50 → 75 |
| 6–9 | Very high | 75 → 100 |
| > 9 | Very high | 100 |

Source: ICMR-NIN 2020 (25–38g fibre/day). FSSAI "source of fibre" = ≥3g/100g; "high fibre" = ≥6g/100g.

### 2.6 Protein (weight: 10%)

| Range (g/100g) | Level | Sub-score |
|---|---|---|
| ≤ 1.6 | None | 0 |
| 1.6–3.2 | Low | 0 → 25 |
| 3.2–6 | Moderate | 25 → 50 |
| 6–12 | High | 50 → 80 |
| 12–20 | Very high | 80 → 100 |
| > 20 | Very high | 100 |

Source: ICMR-NIN 2020 RDA (0.83g/kg BW/day). FSSAI "high protein" claim = ≥12g/100g.

### 2.7 NOVA group (weight: 10%)

| NOVA Group | Description | Sub-score |
|---|---|---|
| 1 | Unprocessed / minimally processed (rice, dal, vegetables, milk) | 100 |
| 2 | Processed culinary ingredients (ghee, sugar, oil, flour) | 70 |
| 3 | Processed foods (canned fish, salted nuts, traditional pickles) | 45 |
| 4 | Ultra-processed (instant noodles, packaged biscuits, chips, soft drinks) | 10 |
| Unknown | Not classifiable | 50 |

Source: Monteiro CA et al., "Ultra-processed foods: what they are and how to identify them", Public Health Nutrition 2019.

NOVA classification is sourced from the product database when available (OpenFoodFacts, USDA). Otherwise a heuristic classifier (`engines/score/nova.ts`) analyses ingredient names for INS numbers and keyword signals.

---

## 3. Composite formula

```
score = (sodium_score × 0.20)
      + (sugar_score  × 0.20)
      + (sat_fat_score × 0.15)
      + (trans_fat_score × 0.10)
      + (fibre_score  × 0.15)
      + (protein_score × 0.10)
      + (nova_score   × 0.10)
```

All weights sum to 1.0. The result is rounded to 1 decimal place.

---

## 4. Score bands

| Score | Band | Meaning |
|---|---|---|
| 80–100 | Excellent | Green |
| 60–79 | Good | Light green |
| 40–59 | Fair | Amber |
| 20–39 | Poor | Orange-red |
| 0–19 | Bad | Red |

---

## 5. Missing data handling

When a nutrient is not declared on the label:
- **Sodium, saturated fat, total sugar**: neutral score (50/100) applied
- **Trans fat**: conservative penalty (70/100, not 50) — safer assumption is that some trans fat may be present in ultra-processed products
- **Fibre, protein**: minimal score (30/100) applied — absence of a positive nutrient is penalised
- **NOVA group** (when ingredient list is empty): Group 3 assumed (low confidence)

---

## 6. LLM policy

The LLM (via `apps/api/src/explain/explainer.ts`) can only **explain** the pre-computed score in plain language. It cannot:
- Modify the score or any sub-score
- Override any nutrition field
- Provide medical diagnoses or treatment recommendations
- Make specific dosage or quantity claims

The CI check `scripts/audit-llm-writes.ts` statically verifies that no code path from the LLM gateway can write to score fields.

---

## 7. Versioning

Every score stored in the database includes `algorithm_version` from `engines/score/version.ts`. This enables:
- Detection of score changes when thresholds are updated
- Future recalculation of historical scores with a new algorithm

Increment `SCORE_ALGORITHM_VERSION` whenever thresholds, weights, or scoring logic changes. Document the reason in the changelog in `version.ts`.

---

## 8. Regulatory citations

| Regulation | Used for |
|---|---|
| ICMR-NIN Recommended Dietary Allowances 2020 | Protein, fibre, saturated fat thresholds |
| WHO Salt Reduction Guideline (2023 update) | Sodium thresholds and salt equivalent |
| WHO Free Sugars Guideline (2015) | Sugar thresholds |
| WHO Eliminate Trans Fats Global Target (2023) | Trans fat thresholds |
| FSSAI Food Safety and Standards (Labelling and Display) Regulations 2022 | Indian labelling thresholds, NOVA 4 additives |
| NOVA Classification — Monteiro et al. 2019, Public Health Nutrition | NOVA groups and sub-score mapping |
| Codex Alimentarius CAC/GL 36 | INS additive numbering |
