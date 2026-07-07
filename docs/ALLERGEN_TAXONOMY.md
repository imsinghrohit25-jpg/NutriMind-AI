# NutriMind AI — Allergen Taxonomy

**Version:** 1.0.0  
**Effective:** 2026-07-07  
**Regulatory basis:** FSSAI Food Safety and Standards (Allergens) Regulations 2023; EU Regulation 1169/2011 Annex II

---

## Overview

NutriMind detects 14 allergen categories in product ingredient lists and raw label text. Detection is done by the deterministic `allergen/detector.ts` engine — no LLM is involved in allergen detection.

Three match types are returned:
- **`declared`** — allergen keyword found in ingredient list (unsuppressible warning)
- **`trace`** — "may contain" or facility cross-contamination language in raw label text (unsuppressible warning)
- **`possible`** — ambiguous facility language without specific allergen named (can be dismissed per session)

### Unsuppressible warnings

Allergen warnings of type `declared` or `trace` are **unsuppressible by the user**. They reappear every scan. This is a hard product policy: a user with a peanut allergy who scans a product containing peanuts or "may contain peanut" MUST see the warning on every scan without exception.

### Fail-safe

When OCR confidence is < 0.5 or parse quality is `low`/`unknown`, the fail-safe triggers and ALL profile allergens receive a blanket warning, regardless of whether the ingredient list was parsed. This prevents silent allergen misses due to label damage or blurry images.

---

## Allergen categories

| ID | Display name | FSSAI mandatory declaration | Notes |
|---|---|---|---|
| `gluten` | Gluten (Wheat/Barley/Rye) | Yes | Includes maida, atta, suji |
| `peanut` | Peanut (Groundnut) | Yes | Includes arachis oil |
| `tree_nuts` | Tree Nuts | Yes | Cashew (kaju), almond (badam), walnut (akhrot), pistachio (pista) |
| `milk` | Milk (Dairy) | Yes | Includes ghee, paneer, whey, casein |
| `egg` | Egg | Yes | Includes albumin, lecithin (egg) |
| `soy` | Soy (Soybean) | Yes | Includes TVP, tofu, tamari |
| `fish` | Fish | Yes | Includes anchovy, worcestershire sauce |
| `shellfish` | Shellfish / Crustaceans | Yes | Shrimp, prawn, crab, lobster |
| `sesame` | Sesame | Yes (FSSAI 2023 amendment) | Includes til, gingelly, tahini |
| `mustard` | Mustard | No (EU mandatory; FSSAI advisory) | Includes sarson, rai |
| `celery` | Celery | No | EU Annex II allergen |
| `lupin` | Lupin | No | EU Annex II allergen |
| `molluscs` | Molluscs | No | Squid, octopus, clam, oyster |
| `sulphites` | Sulphites / Sulphur dioxide | Yes (when > 10 mg/kg) | E220–E224; triggers at any declared level |

---

## Detection keyword approach

Each allergen has two keyword sets:
1. **`keywords`** — scanned against the parsed ingredient name list (case-insensitive substring match)
2. **`traceKeywords`** — scanned against raw OCR label text to find "may contain" statements

The keyword sets are defined in `apps/api/src/engines/allergen/taxonomy.ts`. Additional keywords can be added there when new ingredient forms are identified.

---

## Household member profiles

Allergen profiles are stored per household member, not per user account. This allows a family to manage different allergen profiles for each person. Allergen warnings are evaluated for the **active member** selected at scan time.

---

## Regulatory citations

| Regulation | Used for |
|---|---|
| FSSAI Food Safety and Standards (Allergens) Regulations 2023 | Mandatory declaration list for India |
| EU Regulation 1169/2011, Annex II | Extended allergen list (mustard, celery, lupin, molluscs) |
| EFSA Scientific Opinion "Southampton Six" (2009) | Child artificial colour warnings |
