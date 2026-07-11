# ADR-0033: UK CoFID 2021 Integration

**Status:** Accepted — implemented and verified
**Date:** 2026-07-11
**Authors:** Engineering
**Related:** ADR-0016 (Unified Global Food Database), ADR-0031 (IFCT 2017 — the `IfctLoader`
placeholder-to-real-data pattern this integration follows), ADR-0032 (CNF 2026 — the nutrient
mapping / value-state / never-auto-merge patterns this integration reuses)

---

## Context

The official UK government food composition database — McCance and Widdowson's Composition of
Foods Integrated Dataset (CoFID), 2021 edition, published by Public Health England / the Office
for Health Improvement and Disparities (OHID) — was added as a fourth bulk-imported nutrition
source alongside USDA FDC (live API), IFCT 2017 (India), and CNF 2026 (Canada). The real workbook
(`McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021.xlsx`) was provided directly by
the product owner and verified present before any implementation began (Gate 0).

## 1. A placeholder integration already existed — extended, not replaced

Before this work started, `apps/api/src/datasources/cofid/{loader.ts,normalize.ts}` already existed
from the Phase 9 (Incremental Regional Sync) work: a real, live `CofidLoader` class, decorated onto
`fastify.cofid` in `app.ts` and consumed by `resolution/country-waterfall.ts` and
`packs/sync-service.ts`. It read from `data/cofid/cofid.json` — a flat, hand-typed placeholder
format that was never actually populated, since no real dataset existed at Phase 9 time (documented
risk R-01, same pattern as IFCT's own pre-ADR-0031 placeholder).

This is exactly the situation ADR-0031 encountered with `IfctLoader`: a real, live class with real
call sites, whose *internals* needed to change from placeholder to real data while its *public
contract* — `isAvailable()`, `getByCode()`, `searchByName()`, `toCanonicalProduct()`, `getAll()`,
`size` — stayed identical, so every existing caller kept working unchanged. This integration follows
the same discipline: `CofidLoader.load()` now reads the real xlsx workbook (via new
`xlsx-loader.ts`/`validate.ts`/`normalize.ts` modules), but the class's own public methods are
untouched. The one real external call site with a type-level dependency on the internal shape
(`packs/sync-service.ts`, which read `food.food_code`/`food.food_name` directly instead of going
through a method) was updated to the new field names (`sourceId`/`name`) — a minimal, mechanical
fix keeping the test's own fixture in sync with the real type it exercises, verified by running the
full existing test suite for every consumer (`sync-service.test.ts`, `packs.test.ts`,
`country-waterfall.test.ts`) before and after.

## 2. Real file structure: a 14-sheet workbook, 4 sheets imported, 10 deferred

CoFID 2021 ships as a genuine multi-sheet Excel workbook (verified directly, not assumed from the
governing prompt's generic description): `List of tables` (a table of contents, not a dictionary —
see §5), `1.1 Notes`, `1.2 Factors`, `1.3 Proximates`, `1.4 Inorganics`, `1.5 Vitamins`, `1.6
Vitamin Fractions`, `1.7`–`1.12` (saturated/monounsaturated/polyunsaturated fatty acids, each as a
"per 100g fatty acid" / "per 100g food" pair), `1.13 Phytosterols`, `1.14 Organic Acids`. Every
sheet shares the same 7 identity columns (Food Code, Food Name, Description, Group, Previous, Main
data references, Footnote), 3 header rows (human label / CoFID tagname / short label), data from
row 4 — verified directly against the real file, not assumed.

**Imported:** `1.3 Proximates` (the workbook's primary identity sheet — every food's canonical
record comes from here — plus macros, energy in both kcal and kJ, both fibre methods, and, usefully,
fatty-acid-**category** totals "per 100g food" (`SATFOD`/`MONOFOD`/`POLYFOD`/`FODTRANS`), which
cover the practically useful fat-subtype data without needing the deferred detail sheets),
`1.4 Inorganics` (minerals), `1.5 Vitamins`, `1.6 Vitamin Fractions` (vitamin sub-breakdowns).

**Deferred, each investigated and documented, not silently skipped** (Prime Directive discipline
established since ADR-0031): `1.2 Factors` is nitrogen/energy conversion metadata, not nutrient
values, out of scope for a nutrition-tracking canonical model. `1.7`–`1.12` are individual
fatty-acid-chain breakdowns (e.g. C4:0 through C22:6) — highly specialized biochemistry data whose
practically useful category totals are already covered by Proximates' own `SATFOD`/`MONOFOD`/
`POLYFOD`/`FODTRANS` columns. `1.13 Phytosterols` and `1.14 Organic Acids` are similarly specialized
minor-compound panels. None of these are fabricated or estimated from the imported sheets — they are
simply not yet imported, and could be added later as a genuinely additive follow-up.

## 3. Real symbol set — verified by scanning every cell, not assumed

The governing prompt describes four value-state symbols: `N`, `Tr`, a bracket-wrapped estimate, and
`-`/blank. Every non-identity cell across all 4 imported sheets (~154,000 cells) was scanned
directly. Result: **only `Tr` (trace) and `N` (present, not reliably quantified) actually occur** in
these sheets. Zero occurrences of `-`, blank-as-text, or a bracket `[value]` anywhere in the entire
14-sheet workbook. A **parenthesis**-wrapped convention (e.g. `(0.07)`) — functionally the same
"estimated" concept the prompt describes, just parentheses instead of brackets in this real edition
— does exist, but only in `1.8 (SFA per 100gFood)`, a deferred sheet. `validate.ts`'s
`parseCofidValue()` still implements parenthesis parsing for forward compatibility (mapped to the
new `'estimated'` `NutrientValueState`, added additively to the existing enum — JSONB-stored, zero
migration needed), but this is honestly documented as unexercised by any real fixture in the 4
imported sheets, not overstated as tested against real occurrences it doesn't have.

## 4. Nutrient mapping: tagname-first, `CHO` = available carbohydrate (not by-difference)

Like CNF (and unlike IFCT's positional PDF reconstruction), every CoFID nutrient is unambiguously
identified by its own tagname (row 2 of every sheet — e.g. `PROT`, `VITC`, `BCAR`), enabling direct
mapping with zero positional guessing. `nutrient-map.ts`'s `COFID_DEDICATED_FIELD_MAP` maps ~22
tagnames onto the existing dedicated `NutritionPer100g` fields already populated by USDA/IFCT/CNF —
never a duplicate. The remaining ~65 tagnames across the 4 imported sheets route through
`nutrient_extra`, keyed by their own real tagname (e.g. `MG`, `THIA`, `BCAR`), the same sidecar
discipline ADR-0031/0032 established.

**`CHO` is CoFID's own available-carbohydrate figure** (monosaccharide equivalents) and is mapped
directly onto `carbohydratesG` — never recomputed "by difference," per the governing prompt's own
§1.7 guidance and matching this integration's respect for the source's own authoritative value
(the same reasoning ADR-0032 already established for CNF's own carbohydrate figure — see §7 there
for why "protein is derived using food-specific nitrogen conversion factors" also means never
recomputing protein).

**Two fibre methods are reported** — NSP/Englyst (`ENGFIB`) and AOAC (`AOACFIB`). AOAC is mapped to
the dedicated `dietaryFiberG` field: it is the modern method aligned with the Codex/US definition
this schema's `dietaryFiberG` already assumes for USDA/CNF, keeping cross-source fibre comparisons
meaningful. NSP is kept in `nutrient_extra`, never discarded.

**Vitamin A and D need a unit/basis conversion**, handled as special cases in `normalize.ts`, reusing
existing shared utilities (never a duplicated formula): `RETEQU` (Retinol Equivalent, mcg) →
`vitaminAIu` via the existing `vitaminARaeToIu` (the same one USDA/CNF already use); `VITD` (mcg) →
`vitaminDIu` via the existing `vitaminDMcgToIu` (previously unused by any other source — confirmed
by direct code search before use, not assumed to already be wired in).

## 5. No group-name lookup in this edition — raw code used honestly, not fabricated

CoFID's own `Group` column uses a real, detailed 121-code taxonomy (e.g. `A`, `AA`, `AB`, ..., `H`,
`J`, ..., `S`, ...) — verified directly by enumerating every distinct value in the real workbook.
Unlike CNF (which ships `CNF_Food_Group.csv` with real English names), **this CoFID edition ships no
group-code-to-name lookup anywhere** — the `List of tables` sheet is a table of contents, not a
dictionary, confirmed by reading its actual content. Fabricating label text from external
knowledge/memory not present in the verified source file would violate the master prompt's own
data-honesty rule, so the raw code is stored as both `food_groups.code` and `display_name` — an
honest limitation of this specific workbook edition, not an oversight, documented here rather than
silently guessed at.

## 6. Real bug found and fixed: `food_groups` needed per-source scoping

`food_groups.code` was a bare, globally-unique `PRIMARY KEY` with no source scoping — invisible
while only IFCT (single letters A–T) and CNF (pure numeric 1–25) existed, since their vocabularies
never overlapped. CoFID's own 121-code taxonomy **does** collide: CoFID's group `H` and IFCT's group
`H` ("Nuts and Oil Seeds") are unrelated categories that would fight over the same primary-key row
via `ON CONFLICT (code) DO NOTHING`, silently corrupting whichever source's metadata lost the race.
Verified the real collision directly (IFCT's `H` = "Nuts and Oil Seeds"; CoFID's own `H`-coded foods
include "Allspice, ground" — herbs/spices, an unrelated category) before concluding this needed a
real fix, not a workaround. Fixed via migration 0032: widened the primary key to `(source, code)`.
Verified zero blast radius first — no other table has a foreign key to `food_groups` (it is a
lookup table read only at import time, its resolved value copied directly into `products.category`
— never joined against live by any route), confirmed by a direct code search before making the
change, per the governing protection rule ("before modifying any existing implementation, explain
why it is required").

## 7. Real bug found and fixed: a duplicate Food Code in the official data, and a deduplication gap in the import loop

The real workbook contains a genuine duplicate: Food Code `13-669` is used for two entirely
different foods — "Aubergine, flesh and skin, roasted in rapeseed oil" (row 55) and "Watercress,
raw" (row 2827). `validate.ts` correctly rejects the later occurrence per the governing prompt's own
"duplicate Food Codes within batch → reject later occurrence" rule. **First import attempt still
persisted the wrong row's data**: `validFoodCodes` is a `Set<string>`, so a naive
`validFoodCodes.has(food.foodCode)` check in the import loop let *both* rows through (the code
itself is valid; only one specific *row* should be), and the later row silently won via
`persistProduct`'s `ON CONFLICT (source, source_id) DO UPDATE` — verified directly by querying the
persisted row (`name` came back as "Watercress, raw", not "Aubergine..."), not assumed. Fixed by
tracking already-processed codes during the import loop itself (in both `import-cofid.ts` and
`CofidLoader.load()`, which has the identical loop shape) so the *first* occurrence is the one
actually persisted, matching `validate.ts`'s own stated semantics. Re-verified after the fix: `products`
row for `13-669` correctly shows "Aubergine..."; import count is exactly 2,886 (matching
`validFoodCodes.size`, not 2,887 raw rows).

## 8. `Description` is provenance text, not an alternate name — never used as an alias

The governing prompt's own §1.4 assumed CoFID's `Description` column holds "a longer description of
the food," suitable as an alias/canonical field. Direct inspection of real values (`"8 cans"`,
`"Literature sources"`, `"10 samples, 4 brands"`, `"Calculated from 14-896"`) shows it is actually
sample/provenance/preparation-method text, not a food name synonym. Populating `product_aliases`
from it would inject nonsense search terms like "Literature sources" into the alias index —
`normalize.ts` deliberately never reads this column for anything (ADR-documented deviation from the
prompt's own assumption, resolved by verifying the real data rather than trusting the generic
description, the same discipline ADR-0032 applied to CNF's real file-structure discovery).

## 9. Multi-source identity: CoFID foods are never auto-merged

Per ADR-0032's own established policy (extended here, not re-litigated): every CoFID food becomes
its own independent `products` row (`source='cofid_2021'`), never linked or merged into an existing
USDA/IFCT/CNF canonical identity. Cross-source deduplication remains a documented, deferred
follow-up requiring its own confidence-threshold design.

## 10. Rollback drill and real import — verified independently, not by script self-report

A rollback drill (`--inject-failure-at=13-145`, a real, valid early Food Code) was executed
**before** the real import. The transaction rolled back automatically; verified independently via
direct SQL (not the script's own console output) that 0 CoFID rows existed in `products`/
`food_groups`, that `import_batches` correctly recorded `status='rolled_back'` with the real
injected error message, and that the full regression suite (998 tests) plus a spot-checked IFCT
fixture (Almond, `H001`, `calcium_mg=228.00`) and CNF's own row count (5,993, unchanged) were
byte-identical to their pre-drill state.

The real import ran only after the drill passed: 2,886 foods imported (2,887 parsed, 1 real
duplicate rejected per §7), 121 food groups registered, 0 rejections beyond the one real duplicate,
620 informational proximate/Atwater warnings (non-blocking — same "clean structured government
data, never hard-reject a plausibility heuristic" reasoning ADR-0032 established for CNF). Nutrient
mapping completeness verified by a dataset-wide aggregate, not sampled: 159,371 raw non-empty
nutrient cells (across all 4 sheets, valid/deduplicated foods) exactly equals 159,371 total
`nutrient_value_state` JSONB keys persisted across every CoFID row — 100%, zero drops.

## 11. Addendum (SourceSelectionPolicy / AI citation / performance) — honest scope assessment

The addendum's §A (`SourceSelectionPolicy`) is **substantially, but not fully, already real**:
`resolution/country-waterfall.ts` (built at Phase 3, extended nowhere since) already implements
per-country source priority — GB → CoFID first, IN → IFCT first, both falling through to
OpenFoodFacts then USDA — gated behind `global.p3.unified_food_schema`, tested
(`country-waterfall.test.ts`), and verified to work correctly against this integration's real
`CofidLoader` (its `searchByName()`/`toCanonicalProduct()` contract is unchanged). At the time this
ADR was first written, this file was not wired into any live route — `app.ts`'s own comment
confirmed "country-waterfall.ts (itself not wired into any route) constructed one ad hoc" — the
real, currently-serving resolution path was the country-agnostic `resolution/waterfall.ts`.

**Addendum: wired into the live route (2026-07-11, same day, follow-up commit).** `routes/v1/
resolve.ts` (`POST /v1/resolve/barcode` and `POST /v1/resolve/name`) now calls
`resolution/country-waterfall.ts`'s `resolveBarcode`/`resolveByName` instead of the plain
`waterfall.ts` versions directly. This required no new plumbing: `request.country` is already
decorated on every request by the pre-existing `country/plugin.ts` (Phase 1), and `fastify.cofid`
already existed as a decorator (added specifically for this file's own future use, per `app.ts`'s
own comment). Added a module-level cached flag check for `global.p3.unified_food_schema`, following
the exact same pattern already used by `country/plugin.ts` and `routes/v1/agent.ts` (`global` row
only, 5-minute cache, fails closed to the existing default behavior on any DB error). Because
`country-waterfall.ts`'s own two functions already delegate straight through to the plain waterfall
when `engineEnabled` is false, `resolve.ts` always calls the country-aware entry point — there is no
if/else — and the flag being OFF (its current default) makes the route byte-identical to its
pre-wiring behavior, verified by a real test (`routes/v1/__tests__/resolve.test.ts`, new — no
route-level test existed for this endpoint before): flag OFF ignores CoFID/IFCT entirely even when
available; flag ON correctly resolves GB requests via CoFID, IN requests via IFCT, and falls through
to OpenFoodFacts when the country's priority source has no match; a GB request never receives IFCT
data even when the IFCT loader happens to be available (country-scoping is real, not just present).
6 new tests, full suite re-run (1,015/1,015, 998 original baseline + 11 CoFID + 6 new route tests),
zero regressions.

**Extended to the remaining two call sites (2026-07-11, same day, second follow-up commit), on
explicit request.** `routes/v1/scans.ts`'s `/scans/meal` handler (dish-name resolution for a
photographed meal's top candidate) and `agents/tools/food.ts`'s `food.lookup`/`food.search` tools
(used by the multi-agent system's Nutrition Agent) now call `country-waterfall.ts` the same way,
with the identical flag-check pattern duplicated per-file (matching this codebase's own established
convention of `country/plugin.ts`/`routes/v1/agent.ts` — no shared helper module exists for this
elsewhere either, so none was introduced here). `agents/types.ts`'s `ToolContext` already carried
`cofid: CofidLoader` and `countryCode?: string` (populated from `request.country.isoCode` in
`routes/v1/agent.ts`) — `agents/tools/food.ts` converts that ISO code to a full `CountryProfile` via
the existing `lookupCountryOrGlobal` helper (already used by `agents/tools/country.ts`), defaulting
to `'GLOBAL'` when absent. `agents/specialists/nutrition.ts`'s type-only import was widened from
`ResolutionResult` to `GlobalResolutionResult` (aliased to the same local name, zero other line
changed) since the tool's actual return type now includes `'cofid_2021'` as a possible `resolvedBy`
value — the `product`/`productId` shape is otherwise identical, so this is a pure widening, not a
breaking change.

Neither call site had any existing test coverage before this — added
`agents/tools/__tests__/food.test.ts` (4 tests: flag-off parity, GB→CoFID-first, IN→IFCT-first,
GB-falls-through-when-CoFID-unavailable) and `routes/v1/__tests__/scans-meal.test.ts` (2 tests:
flag-off parity, GB→CoFID-first for the meal-photo top-dish resolution, using a module mock for the
vision-analysis step so the test isolates the resolution wiring itself rather than needing to
replicate the real gateway's JSON-parsing contract). Full suite re-run: 1,021/1,021 (998 original
baseline + 11 CoFID + 6 resolve-route + 6 new here), zero regressions.

**§B (AI citation schema) partially wired, on explicit request (2026-07-11, third follow-up
commit) — `scans.ts` and `food.ts` specifically, `resolve.ts` deliberately left alone.** New shared
module `nutrition/citation.ts` builds a real `NutritionCitation` for any resolved product: source
display name, licence class, attribution text, and terms URL come from a live `data_sources` lookup
(never a hardcoded string — the same table every source's own ADR already treats as the single
source of truth); `importBatchId` comes from the most recent `completed` `import_batches` row
matching the product's `(source, datasetVersion)`, and is honestly `null` (never fabricated) for
live-API sources like USDA/OpenFoodFacts that have no batch import; `dataQualityGrade` reuses the
existing `gradeDataQuality` function from `agents/tools/nutrition.ts` (exported, not re-derived) —
the same real confidence/licence-based grading already used by the Nutrition Agent's own health-
score output; `valueStateNotes` surfaces only nutrients the source itself flags as `'estimated'`
(CoFID's real bracketed/parenthesised convention, §3) — deliberately excluding `'not_analyzed'`/
`'trace'`/`'not_detected'`, since a single CoFID food routinely has a dozen not-analyzed
micronutrients and surfacing all of them would bury the one qualifier that's actually actionable
("this specific number is an estimate") in noise about nutrients the response likely isn't even
showing.

`agents/tools/food.ts`'s `foodLookupTool`/`foodSearchTool` now return `citation: NutritionCitation |
null` alongside the existing resolution fields (a new `FoodResolutionResult` type, additive —
`agents/specialists/nutrition.ts`'s type-only import was updated to match, no logic changed there).
`routes/v1/scans.ts`'s `/scans/meal` response gains a `topCandidateCitation` field built the same
way. `routes/v1/resolve.ts` was **not** touched — the request was specifically scans.ts/food.ts, and
extending the same pattern there is a natural, low-risk follow-up, not assumed. Neither existing
test suite exercised a resolved product with real (non-null) `nutrition` data before this — updated
both test files' `sql` mocks to include a `data_sources`/`import_batches` case and a `.json()`
passthrough (postgres.js's real `Sql` tag carries this helper; a plain `vi.fn()` mock doesn't), and
added `nutrition/__tests__/citation.test.ts` (6 tests covering: null on no-nutrition, null on a
missing `data_sources` row rather than a fabricated fallback, a full real citation build, null
`importBatchId` when no batch exists, the estimated-value-note filtering, and grade boundaries).

Full suite re-run: 1,031/1,031 (998 original baseline + 11 CoFID + 6 resolve-route + 6 scans/food
country-wiring + 10 new citation tests), zero regressions.

**§C (performance baseline/comparison) remains an open, explicit gap** — it needs a real measured
baseline/comparison run through the now-partially-wired AI path, which doesn't exist as a complete,
live, request-driven flow yet. Not fabricated as complete.

## Consequences

- `products`/`product_nutrition` gain 2,886 new rows (`source='cofid_2021'`); zero existing
  USDA/IFCT/CNF rows touched (verified: row counts and spot-checked values identical pre/post).
- `food_groups` gains 121 new rows and, going forward, correctly scopes every source's own group
  vocabulary — a real, load-bearing fix, not merely additive.
- `NutrientValueState` gains one new member (`'estimated'`), JSONB-stored, zero migration.
- The pre-existing `CofidLoader`/`packs/sync-service.ts`/`country-waterfall.ts` integration surface
  now serves real UK data for the first time, with its public contract unchanged.
- `routes/v1/resolve.ts`, `routes/v1/scans.ts` (meal-photo resolution), and
  `agents/tools/food.ts` (the multi-agent system's `food.lookup`/`food.search` tools) all now call
  the country-aware waterfall (§11) — byte-identical when `global.p3.unified_food_schema` is OFF
  (its current default), country-prioritized when ON. Every real caller of the plain
  `resolution/waterfall.ts` in this codebase has now been migrated to the country-aware entry point.

## Follow-ups (tracked, not blocking)

- Cross-source deduplication (CoFID ↔ USDA ↔ IFCT ↔ CNF for the same real-world food) — deferred
  per §9, same open item ADR-0032 already tracked.
- AI citation schema (addendum §B) and performance baseline/comparison (addendum §C) — both need a
  live AI/agent path consuming the now-wired resolution route to produce a real, measured (not
  synthetic) result.
- The 10 deferred CoFID sheets (§2) remain a real, valuable, additive follow-up if a consumer needs
  fatty-acid-chain-level or phytosterol/organic-acid detail.
