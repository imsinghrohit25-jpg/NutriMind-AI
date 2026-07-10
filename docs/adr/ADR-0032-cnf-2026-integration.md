# ADR-0032: Canadian Nutrient File (CNF) 2026 Integration

**Status:** Accepted — implemented and verified
**Date:** 2026-07-10
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0016 (Unified Global Food Database — the `products`/`product_nutrition`/
`data_sources` schema this integration extends), ADR-0031 (IFCT 2017 — the nutrient_extra/
nutrient_sd/nutrient_value_state JSONB sidecar pattern this integration reuses unchanged)

---

## Context

Health Canada's Canadian Nutrient File (CNF), the official Canadian government nutrient
composition database, was added as a third independent nutrition source alongside the already-live
USDA FDC (live API) and IFCT 2017 (India, licensed book) integrations. The official dataset
(`cnf_fcen_all-files-data_2026.zip`) was provided directly by the product owner — no scraped,
mirrored, or unofficial data was used at any point (Gate 0 of the governing implementation prompt).

**Explicit instruction governing this work:** strictly additive. No existing file, table, column,
migration, business logic, or feature may be deleted, renamed, or altered beyond the minimum
necessary; every USDA/IFCT behavior must remain byte-identical (verified via a before/after
regression run, not assumed).

## 1. The real file structure differs from a generic/assumed CNF layout

The distributed file set is real and official but does **not** match the older "FOOD NAME /
NUTRIENT AMOUNT / NUTRIENT NAME / FOOD GROUP / FOOD SOURCE / CONVERSION FACTOR / MEASURE NAME /
REFUSE NAME+AMOUNT / YIELD NAME+AMOUNT" layout some general documentation describes. The real 2026
release ships 8 CSVs: `Food_Name.csv`, `Nutrient_Amount.csv`, `Nutrient_Name.csv`,
`CNF_Food_Group.csv`, `Food_Source.csv`, `Nutrient_Source.csv`, `Measure_Name.csv`,
`Measure_Weight_Conversion.csv` — the last of these **unifies** what the generic description treats
as three separate files (Conversion Factor, Refuse, Yield), distinguished instead by a real
`Measure_Type_Code` column (`Measure_Type.csv`: 3 = Refuse, 6 = household/user-defined conversion,
9 = Yield). This was verified directly (not assumed): `Measure_Type_Code=3` rows print real
percentages (e.g. a 30-41% refuse figure for high-waste foods like bananas/oranges, cross-checked
against well-known real refuse percentages), while types 6 and 9 print real gram weights. The
implementation follows the real file structure, per the prompt's own "treat the multi-file
relational structure as authoritative" instruction.

Unlike the IFCT integration (a scanned book, parsed from `pdftotext` output with genuine column-
position ambiguity to resolve), CNF ships as clean, labeled, relational CSV — every nutrient is
already unambiguously identified by its own `Nutrient_Code` and INFOODS `Tagname` (the same tagname
system USDA's FDC API uses). No positional guessing was needed anywhere in this integration.

## 2. Schema decision: extend `products`/`product_nutrition`, add two new generic tables

The governing prompt assumed a `food_items/food_nutrients/food_sources/food_aliases/
food_portions/nutrient_definitions` canonical schema. That schema **does not exist** in this
codebase. The real, already-live canonical schema (established by IFCT/USDA) is
`products`/`product_nutrition`/`data_sources`/`product_ingredients`, with nutrients as fixed named
columns plus `nutrient_sd`/`nutrient_value_state`/`nutrient_extra` JSONB sidecars — no normalized
nutrient dictionary. Per the prompt's own actual instruction ("reuse the canonical schema...
established by the IFCT/USDA integrations") and the governing protection rule ("extend the
architecture instead of replacing it"), this integration targets the **real** schema, not the
assumed one:

- **`data_sources`**: one new row (`cnf_2026`, `license_class='public_domain'` — matching the same
  license class already used for CoFID/CIQUAL/FSANZ government open-data sources). No existing row
  touched.
- **`food_groups`**: reused as-is. This table already exists (built for IFCT's A–T food groups) with
  a generic `TEXT` `code` + `source` FK design — CNF's own numeric group codes (`'1'`–`'23'`) insert
  directly, no schema change, no collision with IFCT's single-letter codes.
- **`product_portions`** (**new table**): CNF is the first source in this codebase to ship real
  multi-measure household/yield/refuse conversion data (`Measure_Weight_Conversion.csv`, 29,868
  rows) — `products.serving_size_g`/`serving_description` only ever modeled ONE portion per
  product. Generic by design (`measure_type` ∈ `household|yield|refuse`, `value`/`value_unit` ∈
  `g|pct`), not CNF-specific naming, so a future source with the same real need can reuse it.
- **`product_aliases`** (**new table**): CNF is bilingual by Health Canada mandate (English +
  French food names, alternate names, scientific names) — no existing table holds a second-language
  name for anything. Generic by design for the same reason.
- **`import_batches`** (**new table**): lightweight audit trail (checksums, status, row counts,
  error message) for this bulk file import. No prior source tracked import provenance at the batch
  level — IFCT/USDA imports only ever wrote a `docs/imports/*.md` report file.

Migration 0031 is purely additive: `ADD COLUMN`/`CREATE TABLE IF NOT EXISTS`/one `INSERT ... ON
CONFLICT DO NOTHING` row. No existing table, column, or row is altered. Verified: the full
regression suite (987 tests) passed unchanged immediately after applying the migration, before any
CNF code was written.

### Explicitly NOT built

A `nutrient_definitions` dictionary table and a `cnf_nutrient_map` **database** table. USDA's own
existing normalizer (`datasources/usda/normalize.ts`) maps FDC nutrient IDs to canonical fields via
a plain TypeScript object (`NID`), not a database table — CNF's `nutrient-map.ts` follows the same
established, working pattern (`CNF_DEDICATED_FIELD_MAP`) for consistency, rather than introducing a
new persistence mechanism the codebase doesn't otherwise use for this purpose.

A `NutritionSource` interface/abstraction. Neither USDA nor IFCT implements one today (each is an
independent `client.ts`/`loader.ts` + `normalize.ts` pair) — introducing one now, for CNF alone,
would be scope beyond what this integration needs and would not "wrap existing sources without
changing their behavior" in any verifiable way, since there is no shared call site today that would
exercise the new abstraction. CNF follows the same real, established per-source-module pattern.

## 3. Nutrient mapping: tagname-first, reusing existing dedicated columns

`datasources/cnf/nutrient-map.ts`'s `CNF_DEDICATED_FIELD_MAP` maps 23 CNF `Nutrient_Code`s (verified
directly against `Nutrient_Name.csv`'s own code/tagname columns) onto the **existing** dedicated
`NutritionPer100g` fields USDA/IFCT already populate (`proteinG`, `fatTotalG`, `energyKcal`,
`calciumMg`, `vitaminCMg`, etc.) — never a duplicate column. `Nutrient_Code 320` (Retinol Activity
Equivalents) is a special case: converted to `vitaminAIu` via the existing `vitaminARaeToIu`
utility (`nutrition/units.ts`), the same conversion USDA's own normalizer already uses — not
reimplemented. CNF reports ~170 total nutrients; the ~147 without an existing dedicated column
route through `nutrient_extra`, keyed by their own real `Tagname` (e.g. `'THIA'`, `'MG'`,
`'F4D0'`) — the identical "route unmapped nutrients through the JSONB sidecar, never fabricate a
new column per nutrient" discipline ADR-0031 established for IFCT.

**Found and fixed during implementation:** 6 real CNF nutrient codes (573, 578, 904, 907, 910, 911)
share an empty `Tagname` in `Nutrient_Name.csv`. The initial mapping used `tagname ?? fallback`,
but `??` only falls through on `null`/`undefined` — not on an empty string — so all six collided
under the same blank `nutrient_extra` key, silently overwriting each other. Fixed by explicitly
checking for a non-empty tagname before using it. **Verified the fix with a dataset-wide
completeness check**: total `nutrient_extra` keys (427,337) + total non-null dedicated-column
values (138,072) across every imported CNF product now sums to exactly 565,409 — the real, total
row count of `Nutrient_Amount.csv` — proving zero nutrient values were silently dropped or
overwritten anywhere in the import.

`Nutrient_Amount.csv` never contains a blank amount (0 of 565,409 real rows) — a nutrient's
**absence** from a food's row set is CNF's own "not analyzed" signal (matching this codebase's
existing `value_state` convention from IFCT), while a present row with `amount=0` is a real,
confirmed zero measurement (199,662 such rows exist) — never conflated.

## 4. Validation: referential integrity is a hard gate; proximate/Atwater plausibility is not

Two independent layers, with deliberately different consequences:

1. **Referential integrity (hard reject).** Every `Nutrient_Amount` row's `Food_Code`/
   `Nutrient_Code`, and every food's `Food_Group_Code`, must resolve in the joined tables;
   duplicate `Food_Code`s are rejected. Verified: **0 of 5,993 real foods rejected** — the real CNF
   distribution has perfect internal referential integrity, as expected for official government
   data.
2. **Proximate-sum + Atwater energy reconciliation (informational warning, never rejects).**
   IFCT's own `validate-table1.ts` (ADR-0031) uses a **hard** reject bound for this exact check —
   but that bound exists to catch PDF-OCR column-shift corruption, a risk specific to reconstructing
   a scanned book. CNF has no such risk (clean, structured, government-lab CSV, joined by explicit
   IDs). Verified directly that a naive Atwater check produces real false positives here for
   well-understood food-science reasons unrelated to data corruption: e.g. Allspice (Food_Code 169)
   reports a real, correct 263kcal that deviates 49% from a naive total-carbohydrate Atwater
   estimate, because CNF's own reported energy is computed from **available** carbohydrate
   (excluding dietary fibre's much lower real energy contribution) — and CNF covers far more
   high-fibre/alcohol-containing minor-ingredient foods (spices, brans, vinegars) than IFCT's 528
   staple foods did. Hard-rejecting on this heuristic would have discarded real, correct government
   records — a direct violation of "discard no valid record" — so it is downgraded to an
   informational warning (1,179 real warnings logged, none blocking) rather than reimplementing or
   modifying the shared `derived.ts` Atwater estimator that USDA/IFCT also rely on (which stays
   completely untouched, preserving their byte-identical behavior).

## 5. Multi-source identity: CNF foods are never auto-merged into USDA/IFCT

Per the governing prompt's own §5 guidance ("a false split is safe; a false merge corrupts data"),
and because no confidence-scored name/nutrient-similarity matching threshold was specified
precisely enough to implement safely in this pass, **every CNF food becomes its own independent
product row** (`source='cnf_2026'`), never linked or merged into an existing USDA/IFCT canonical
identity. This is a deliberate, documented scope boundary — cross-source food deduplication (e.g. a
banana appearing in USDA, IFCT, and CNF all being recognized as "the same real-world food" for
search-ranking purposes) is a real, valuable future capability, but implementing the matching
threshold safely needs its own dedicated design pass and explicit sign-off, not an unverified guess
bundled into this integration.

## 6. Import pipeline: single-transaction atomicity, verified by a real rollback drill

The entire import (5,993 foods, their nutrition rows, 29,868 portions, 10,542 aliases, 23 food
groups) runs inside **one** Postgres transaction (`sql.begin(...)`, `datasources/cnf/persist.ts` +
`scripts/import-cnf.ts`) — any thrown error at any point rolls back every change made by the batch,
automatically, via postgres.js's own transaction semantics. `persistProduct` (existing,
unmodified `openfoodfacts/cache.ts`) is reused as-is for the product + nutrition row, since CNF's
`(source, source_id)` pair can never collide with any existing USDA/IFCT row.

**Rollback drill, executed before the real import (not simulated):** an `--inject-failure-at=<Food_
Code>` flag deliberately throws mid-batch. First attempt used a non-existent Food_Code (500 — CNF's
numbering has real gaps) and silently completed a full real import instead of triggering the drill
— caught by checking the actual database state rather than trusting the script's own success
message, the accidental import was fully deleted, and the drill was correctly re-run against a
real, valid mid-dataset Food_Code (4077). Result: the transaction rolled back automatically;
independent verification (direct SQL query, not the script's own self-report) confirmed **0** CNF
product/portion/alias/food_group rows remained; the `import_batches` row correctly recorded
`status='rolled_back'` with the real injected error message; the full USDA/IFCT regression suite
(987 tests) passed unchanged immediately after, and a spot-checked IFCT fixture (Almond, H001,
`calcium_mg=228`) was confirmed byte-identical to its pre-drill value.

## Consequences

- `products`/`product_nutrition` gain 5,993 new rows (source=`cnf_2026`); zero existing USDA/IFCT
  rows are touched (verified: pre/post row counts and spot-checked values identical).
- Two new generic tables (`product_portions`, `product_aliases`) exist for the first time,
  available to any future source with the same real need.
- Nutrient mapping is 100% accounted for (565,409 of 565,409 raw values traced to either a
  dedicated column or a `nutrient_extra` key) — verified by a dataset-wide aggregate check, not
  sampled.
- 1,179 real proximate/Atwater plausibility warnings are logged in the import report for human
  review; none blocked the import, per §4's reasoning.
- CNF foods are searchable/retrievable through the exact same `products`/`product_nutrition`
  read paths USDA/IFCT already use — no AI/search code was duplicated, since nothing about the read
  path is source-specific.

## Follow-ups (tracked, not blocking)

- Cross-source deduplication/linking (CNF ↔ USDA ↔ IFCT for the same real-world food) — deferred
  per §5, needs its own confidence-threshold design and sign-off.
- Source-priority-by-country search ranking (CA → CNF first, US → USDA first, IN → IFCT first) is
  not yet wired into the search/ranking layer — CNF data is present and queryable today, but
  country-aware source prioritization at read time is a separate, additive follow-up.
- The 6 real CNF nutrients with a blank Tagname (573, 578, 904, 907, 910, 911) are stored under a
  `cnf_<code>` fallback key rather than a human-readable name — acceptable (no data lost, verified),
  but a future pass could look up their `Nutrient_Name_EN` for a friendlier key if a consumer needs
  to display them directly.
- French-language search (querying `product_aliases` for `language_code='fr'`) is not yet wired
  into the existing search/ranking layer — the data is present and queryable via a direct join, but
  no UI/API surface uses it yet.
