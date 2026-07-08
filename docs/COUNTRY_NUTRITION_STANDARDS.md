# Country Nutrition Standards — Sourcing Reference

**Effective:** 2026-07-08 · **Phase:** 4 (Global Enterprise Edition) · **Flag:** `global.p4.multi_standard_rules` (default `false`)
**Related:** [ADR-0017](adr/ADR-0017-multi-country-nutrition-standards.md), [SCORING_METHODOLOGY.md](SCORING_METHODOLOGY.md) (default/India pack, unchanged)

This document is the per-country citation table backing `apps/api/src/engines/score/standards/`.
Read ADR-0017 §3 first — every pack here is a **five-bucket approximation** anchored to real
published cut-offs, not a literal reproduction of each country's full (often category-specific
and multi-variable) nutrient profiling algorithm. Confidence varies by country; see the note
column.

| Standard id | Country/ies | Authority | Primary source(s) | Confidence |
|---|---|---|---|---|
| `ICMR_NIN` | IN | ICMR-NIN / FSSAI | ICMR-NIN RDA 2020; WHO Salt Reduction 2023; FSSAI Labelling Regs 2022 | High — full prior citation work, see SCORING_METHODOLOGY.md |
| `US_DRI` | US, CA | FDA / USDA | 21 CFR 101.9; FDA Daily Values (sodium 2300mg, sat fat 20g, added sugar 50g, fibre 28g, protein 50g) | Medium — DVs are official; per-100g %DV banding is a practical proxy, not an FDA-published table |
| `UK_SACN` | GB | FSA / DHSC / SACN | FSA Front-of-Pack Traffic Light Guidance 2016 (green/red per-100g cut-offs for sugar, sat fat, salt); SACN Carbohydrates and Health 2015 (30g/day fibre target) | High — FSA publishes exact per-100g cut-offs directly |
| `EFSA` | DE, FR, IT, ES, NL | EFSA / Nutri-Score Coordination Committee | Nutri-Score 2023 algorithm point tables (sugar, sat fat, salt, fibre, protein) | Medium — anchor points confirmed (salt ceiling 4.0g/100g, sat fat 10g/100g cap, fibre 3.0–7.4g, protein 2.4–17g); full point curve not reproduced |
| `NHMRC` | AU | NHMRC / FSANZ | Health Star Rating System general consumer guidance (sodium, sat fat, sugar targets); FSANZ Standard 1.2.7 | Low-medium — HSR's full baseline-points-by-category table (Implementation Guide Appendix 1) not reproduced; simplified consumer-guidance figures used instead |
| `JP_DRI` | JP | Consumer Affairs Agency / MHLW | CAA Food Labeling Standards Appendix Table 13 (confirmed: "low sodium" ≤120mg/100g, "no sodium" <5mg/100g); MHLW DRI 2025 (sodium target 2.9g→2.7g salt/day) | Medium — sodium anchors confirmed directly; sugar/sat-fat "low" claim anchors (5g, 1.5g) are commonly-cited industry figures, not independently re-verified against the primary CAA table in this pass; fibre/protein are Codex-based, not Japan-specific |
| `HPB_SG` | SG | Health Promotion Board | Nutri-Grade Mark (beverages, effective 30 Dec 2023): sugar A≤1g/B≤5g/C≤10g/D>10g per 100ml; sat fat ≤1.2g/100ml for A/B | Low-medium — Nutri-Grade is a **beverage** standard, applied here as a general-food per-100g proxy; Healthier Choice Symbol's category-specific general-food tables (revised July 2025) were not fully retrieved |
| `WHO` | GLOBAL fallback + AE, KR, BR, MX, ID, TH, MY, PH, VN, ZA, NG, EG, SA | World Health Organization | WHO Salt Reduction Guideline (<2000mg Na/day); WHO Free Sugars Guideline 2015 (<50g/day); WHO 2023 saturated fat guideline (<10% energy); WHO REPLACE trans-fat elimination target; Codex CAC/GL 23-1997 (fibre/protein claims) | Medium — daily targets are official WHO figures; per-100g banding (5/10/20/30/40% of daily target) is this project's own conversion method, same as used for `US_DRI` |

## Conversion methods used

- **Salt ↔ sodium:** `sodium_mg = salt_g × 400` (salt = sodium × 2.5).
- **%DV / %daily-target banding** (`US_DRI`, `WHO`): veryLow/low/moderate/high/veryHigh = 5%/10%/20%/30%/40% of the published daily reference value, applied per 100g as a practical single-serving proxy. This is *not* how FDA/WHO define per-serving claims (which use RACC-based reference amounts) — it is a simplification chosen for consistency with the existing five-bucket engine shape.
- **Traffic-light/claim anchors** (`UK_SACN`, `JP_DRI`, `HPB_SG`): where a country publishes exact per-100g cut-offs, those values are used directly for the closest matching bucket; the remaining buckets are linearly interpolated (between two official anchors) or extrapolated (beyond the highest anchor, using a similar ratio to the India pack's own high→veryHigh scaling).
- **Point-table anchors** (`EFSA`): the 2023 Nutri-Score algorithm's confirmed threshold/ceiling values are used as bucket anchors; the full non-linear point curve is not reproduced.

## Known gaps (tracked, not blocking Phase 4)

- No route or background worker currently passes a resolved standard into `computeHealthScore()` — see ADR-0017 §5 "Consequences."
- `life_stage_rules`, `condition_rules`, `allergen_regime_map` (the other three Phase 4 flags) are unimplemented.
- A licensed nutrition-policy/regulatory-affairs review of the seven non-India packs has not been performed. Required before `global.p4.multi_standard_rules` is enabled for any real user (ADR-0017 acceptance gate).
