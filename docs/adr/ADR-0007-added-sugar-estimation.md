# ADR-0007 — Added Sugar Estimation Policy

**Date:** 2026-07-07  
**Status:** Accepted  
**Modules:** M1 (resolution), M5 (scoring), M7 (copilot)  
**Differentiators:** D4 (honesty), D5 (trust)

---

## Context

FSSAI-regulated product labels in India are not required to declare added sugars separately from
total sugars as of 2026. USDA FDC and OpenFoodFacts do not systematically provide added-sugar data
for Indian products. The IFCT 2017 dataset does not include an added-sugar field.

NutriMind's sugar sub-score (Phase 5, Module M5) requires an added-sugar estimate to comply with
WHO guidelines on free sugars, which use added sugar (not total sugar) as the primary metric.

The **prohibition** (Master Prompt § Honesty): LLMs must never generate nutrition values.
Any estimation must be rule-based, transparent, and flagged to users.

---

## Decision

**Three-tier estimation, applied in order:**

| Priority | Condition | Action | `sugars_added_estimated` |
|---|---|---|---|
| 1 | Source provides added sugar directly (OFF field `added-sugars_100g`) | Use verbatim | `false` |
| 2 | Added sugar absent; total sugar present | Use total sugar as conservative upper bound | `true` |
| 3 | Neither field available | Set `null` | `false` |

**Rule 2 rationale:** Total sugars ≥ added sugars by definition (total = added + naturally occurring).
Using total sugars as the upper bound is the most conservative safe-harbour value — it never
*under-estimates* the added sugar impact, which is directionally correct for health scoring.

**User disclosure (D4):**
- Product cards show `†` annotation next to added-sugar values when `sugars_added_estimated = true`
- Tooltip: "Added sugar not labeled on this product. Value shown is total sugars (conservative upper bound)."
- Scoring: when estimated, add ±2g uncertainty band to the sugar sub-score.
- Copilot/report: never state estimated values as facts; always cite the estimation rule.

---

## Energy Consistency Check

Simultaneously, at normalisation time, the Atwater energy estimate is computed:

```
E_estimated = protein_g × 4 + fat_g × 9 + carbs_g × 4   (kcal/100g)
```

If `|E_reported − E_estimated| / E_reported > 10%`, a note is written to `product_nutrition.notes`.
The **reported** energy value is always used; the note exists for transparency only.

This check does not affect the `sugars_added_estimated` flag.

---

## Consequences

**Positive:**
- Nutritional scoring is always based on declared or conservatively estimated values — never fabricated.
- The `sugars_added_estimated` flag propagates through scoring, copilot text, and weekly reports,
  so every downstream consumer knows whether to apply uncertainty margins.
- Future improvement: when FSSAI mandates added-sugar labelling, the rule-2 path naturally
  becomes less common without any code changes.

**Negative:**
- Rule 2 may over-state added sugar for products with high natural sugars (e.g., dried fruits,
  fruit juices). This is a known limitation, documented in the UI tooltip.

---

## Implementation

`apps/api/src/nutrition/derived.ts` — `estimateAddedSugar()`, `energyConsistencyNote()`  
`apps/api/src/datasources/openfoodfacts/normalize.ts` — calls `estimateAddedSugar`  
`apps/api/src/datasources/usda/normalize.ts` — calls `estimateAddedSugar`  
`apps/api/src/datasources/ifct/loader.ts` — calls `estimateAddedSugar`  
`apps/api/src/nutrition/__tests__/canonical-model.test.ts` — test coverage
