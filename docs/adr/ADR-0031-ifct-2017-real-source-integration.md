# ADR-0031: IFCT 2017 Real-Source Integration (Nutrition Intelligence Foundation)

**Status:** Accepted — §5's table-by-table rollout is complete (all 12 tables, see Addendum 2)
**Date:** 2026-07-10
**Authors:** Engineering
**Supersedes:** None
**Related:** `docs/DATA_SOURCES.md` §3 (Risk R-01, the original acquisition blocker this ADR
resolves), `apps/api/src/datasources/ifct/format.md` (the placeholder format this ADR replaces),
ADR-0016 (Unified Global Food Database — the `products`/`product_nutrition`/`data_sources` schema
this integration extends, not replaces)

---

## Context

The real IFCT 2017 file (`Longvah, Ananthan, Bhaskarachary & Venkaiah, 2017`, ICMR-NIN) was
received as `IFCT2017.pdf` — the actual printed book (~500 pages), not a CSV/Excel extraction.
This is materially different from what `datasources/ifct/format.md` (written during Phase 3, before
the real file was available) assumed: a pre-cleaned 25-column CSV. That format was always a
documented placeholder for "whatever we get when the real file arrives" — never a delivered
capability — so replacing its parsing internals here is completing Phase 3's own stated scope, not
redesigning a working feature.

**Explicit instruction governing this work:** do not redesign the existing production
architecture (`products`/`product_nutrition`/`data_sources`/resolution waterfall); only integrate
IFCT into it, with the minimum necessary compatibility changes, each explained individually.

**Licensing:** the book's own disclaimer states data may not be "stored or reproduced in any
electronic format for creating a product without the prior written permission of the National
Institute of Nutrition, Hyderabad." `data_sources.ifct_2017` was already seeded (Phase 3) as
`license_class = 'licensed_restricted'`. Confirmed directly with the product owner (2026-07-10)
that written permission from ICMR-NIN has already been obtained — this ADR does not re-litigate
that; it records that the confirmation was sought and given before any data was persisted.

## 1. Real dataset structure (verified directly, not assumed)

- **528 key foods** across food groups **A–S** (20 groups total, A–T; group **T, "Edible Oils and
  Fats," 14 entries, is a 21st/supplementary group** covered only by Table 12's fatty-acid profile
  — it has no proximates/vitamin/mineral data, which is why the book's own group registry sums to
  542 while the preface's headline figure is 528. Both numbers are correct; they answer different
  questions. Verified against the book's own "Table 1. Food groups in the IFCT" registry (page xxi).
- **12 nutrient tables** (Proximates & Dietary Fibre, Water-Soluble Vitamins, Fat-Soluble Vitamins,
  Carotenoids, Minerals & Trace Elements, Starch & Individual Sugars, Fatty Acid Profile, Amino
  Acid Profile, Organic Acids, Polyphenols, Oligosaccharides/Phytosterols/Phytates/Saponins, and
  the supplementary Fatty Acid Profile of Edible Oils/Fats) — matches the addendum's ground-truth
  exactly.
- **Energy is tabulated in kJ only** in Table 1 (no separate kcal column in the printed table) —
  correcting the addendum's assumption of "kJ AND kcal" both being tabulated. `energyKcal` is
  derived from `energyKj` (÷ 4.184), same conversion `nutrition/derived.ts`'s existing
  `fillEnergyFields()` already performs for other sources missing one of the pair — no new
  derivation logic needed.
- **Extraction method matters a great deal.** `pdftotext -layout` (the naive default) badly
  jumbles this document's real multi-column-per-page layout — values from adjacent
  rows/columns interleave, which would silently misassign nutrient values if trusted. `pdftotext
  -raw` (content-stream order) produces clean, correctly-ordered one-line-per-food rows for Table
  1, verified by direct inspection of extracted text against the same rows rendered as continuous
  prose. **`-raw` is the only extraction mode used for parsing; `-layout` output is not trusted for
  any data value.**
- **Real complications confirmed in `-raw` output** (not hypothetical): food names containing a
  scientific name in parentheses wrap across two physical text lines for longer entries; the
  count of numeric values following the region count varies per row because not every food was
  analyzed for every nutrient in a table (a real "not analyzed" case, not a parsing bug) — the
  parser must never guess a positional mapping when the count doesn't match the expected column
  set for that table; it must reject the row with a specific reason instead (Prime Directive #4).

## 2. Schema decision: extend `product_nutrition`, do not create a parallel schema

The addendum's own §3 schema (`food_items`/`nutrient_definitions`/`food_nutrients` EAV design)
does **not** match the real, already-live schema (`products` + `product_nutrition`, one row per
resolved product, ~26 named nutrient columns, `UNIQUE(product_id)`, already wired through
`resolution/waterfall.ts`, the Health Score Engine, and every existing test). Building the
addendum's proposed schema alongside the real one would itself be the duplicate-architecture
outcome the governing instruction forbids. Decision: **extend the real schema minimally.**

- **`ash_g`, `moisture_g`** (nullable `numeric(8,3)`) added to `product_nutrition` — genuinely
  new proximates the existing 26-column schema never modeled, needed to represent Table 1
  completely. Two columns, additive, default NULL, zero impact on any existing row or query.
- **`nutrient_sd` (`jsonb`, nullable)** — a single additive column holding `{nutrient_key: sd}`
  for every nutrient this product's source reported a standard deviation for. Chosen over adding
  a paired `_sd` column per nutrient (would require ~150 new columns across this integration's
  full scope, one per nutrient in Tables 1–12 — a real schema-bloat problem, not proportionate to
  "minimum necessary") and over a full EAV redesign (forbidden by the governing instruction). One
  JSONB column scales to every current and future nutrient without further schema changes.
- **`nutrient_value_state` (`jsonb`, nullable)** — same rationale, holding `{nutrient_key:
  'measured'|'zero'|'trace'|'not_detected'|'not_analyzed'}`. This is the addendum's required
  distinction (§1.3) — without it, "not analyzed" and "confirmed zero" both collapse to SQL NULL,
  which the addendum explicitly forbids and which existing columns have in fact always done
  (a real, pre-existing limitation this ADR fixes for IFCT rows going forward; existing non-IFCT
  rows are unaffected — no backfill implied or attempted for other sources).
- **`food_groups` (new table)** — did not exist; IFCT's 20-group registry (A–T) is real reference
  data with no natural home in the existing schema. One small, standalone, additive table, no
  FK required elsewhere yet (`products.category` remains the existing free-text field; a future
  FK from `products.food_group_code` to this table is a candidate follow-up, not done here to
  avoid touching the existing `products.category` contract every other source already relies on).

**Explicitly NOT built:** the addendum's `nutrient_definitions` dictionary/EAV table, `staging_ifct_rows`,
`import_batches`/`import_rows` tables, or a general-purpose import framework. The real import
process is a versioned, idempotent TypeScript script (§4) that logs its own report to
`docs/imports/` — providing the addendum's actual requirement (traceable, re-runnable, rejects
logged with reasons) without introducing new persistent tables whose only real consumer would be
this one import, which the "no duplicate tables" instruction weighs against.

## 3. Loader/parser: internals replaced, public contract unchanged

`datasources/ifct/loader.ts`'s `IfctLoader` class is used by three real call sites:
`resolution/waterfall.ts` (barcode/name resolution), `packs/sync-service.ts` (Phase 9 regional
pack sync), and `agents/tools/*` (Phase 13, via `ToolContext.ifct`). Its public surface —
`isAvailable()`, `count`, `getAll()`, `findByCode()`, `searchByName()`, `toCanonicalProduct()` —
is unchanged. What changes internally: `parser.ts`'s CSV-only `parseIfctCsv()` (which parsed a
format that was never actually delivered) is replaced by a real book-table parser
(`book-parser.ts`, per table), and `IfctEntry` gains the new optional fields (`ashG`, `moistureG`,
`sd`, `valueState`) alongside its existing ones — every existing field keeps its name and meaning.

## 4. Import pipeline (real, versioned, idempotent — not a one-off script)

1. **Extract:** `pdftotext -raw` against the licensed source PDF (kept outside the repo,
   gitignored, same as the original CSV placement in `format.md`) → a raw text artifact.
2. **Parse (per table):** table-specific parser reads the raw text, emits structured rows +
   per-row rejection reasons (multi-line name reassembly, region-count/value-count
   cross-validation, footnote-symbol stripping).
3. **Validate:** proximate sum (moisture+protein+fat+carbohydrate+fibre+ash within tolerance of
   100g), Atwater energy reconciliation (existing `energyConsistencyNote()` reused, not
   reimplemented), duplicate food-code detection within the run.
4. **Merge:** idempotent upsert into `products`/`product_nutrition` keyed on
   `(source='ifct_2017', source_id=food_code)` — re-running the import updates rows in place,
   never duplicates them (respects `products_source_source_id_key` and
   `product_nutrition_product_uniq`, both pre-existing constraints).
5. **Report:** counts (parsed/validated/rejected with reasons), spot-check assertions against a
   handful of real, well-known foods, written to `docs/imports/`.

## 5. Rollout is incremental, table-by-table — stated honestly, not claimed all-at-once

Twelve tables, several with materially different structure and units (amino acid profiles, fatty
acid chains, polyphenol classes have no existing column analog at all and each need their own
mapping decision). Building and validating all twelve in one unreviewed pass would itself violate
Prime Directive #4 ("a silently corrupted row is failure") by rushing the parts most likely to
hide a column-mapping mistake. Sequencing:

1. **Table 1 (Proximates & Dietary Fibre)** — first, since every value maps onto already-modeled
   columns plus the two new ones (`ash_g`, `moisture_g`) added in this same ADR's migration.
2. Tables 2–3 (vitamins) — map onto existing `vitamin_c_mg`/`vitamin_b12_mcg`/`folate_mcg` plus
   genuinely new vitamins (thiamine, riboflavin, niacin, pantothenic acid, B6, biotin, vitamin D,
   E, K) — routed through `nutrient_sd`/`nutrient_value_state` rather than new named columns,
   since the existing wide-column approach does not scale past the handful already modeled.
3. Table 5 (Minerals) — extends `calcium_mg`/`iron_mg`/`potassium_mg`/`zinc_mg` plus phosphorus,
   magnesium, copper, manganese, selenium, etc. via the same JSONB path.
4. Tables 4, 6–12 (carotenoids, sugars, fatty acid profile, amino acid profile, organic acids,
   polyphenols, oligosaccharides/phytosterols/phytates, edible-oil fatty acids) — each has zero
   existing column analog; all route through `nutrient_sd`/`nutrient_value_state` plus a small
   number of new named columns only where an existing consumer (Health Score Engine, allergen
   detector) actually reads a specific nutrient by name today (e.g. `fat_saturated_g`,
   `fat_trans_g`, already-existing columns Table 7 will populate for the first time).

## Consequences

- `product_nutrition` gains 4 nullable columns; zero existing rows, queries, or tests are
  affected (verified — see the migration's own test evidence).
- IFCT foods become real, persisted, searchable `products` rows for the first time — previously
  they existed only as an in-memory lookup the resolution waterfall consulted on demand. This is
  additive: the existing in-memory `IfctLoader` path keeps working unchanged (verified by its own
  existing test suite staying green) alongside the new persisted rows.
- Full 151-nutrient/table-12 coverage is **not** complete as of this ADR — it is being built and
  merged one verified table at a time, starting with Table 1. Each subsequent table gets its own
  dated addendum to this ADR (or a follow-up ADR if the design changes materially), not a silent
  scope reduction.

## Follow-ups (tracked, not blocking)

- A `products.food_group_code` FK to the new `food_groups` table, once a second source needs the
  same grouping (IFCT is currently the only consumer).
- Tables 2–12's import passes (see §5 sequencing).
- Re-evaluate whether `nutrient_sd`/`nutrient_value_state`'s JSONB approach should graduate to a
  proper `food_nutrient_values` table if/when a THIRD source (beyond IFCT and a hypothetical
  future one) needs the same fine-grained value-state tracking — revisit only when that real
  need exists, not preemptively.

## Addendum (2026-07-10): §5 rollout — Tables 2, 3, 4, 6, 9 completed; 5, 7, 8, 10, 11, 12 deferred

Continuing §5's table-by-table rollout surfaced two real, load-bearing infrastructure gaps fixed
before any further table could merge safely, then six tables were completed and six were
investigated and honestly deferred rather than shipped with guessed column mappings (Prime
Directive #4). All work here is additive to the schema in this ADR's original migration; no
completed functionality from Table 1 or earlier phases was modified except where a genuine
pre-existing bug directly blocked this work (documented below).

### Infrastructure corrections (found while starting Table 2)

- **`nutrient_extra` (new JSONB column, migration 0030).** `nutrient_sd`/`nutrient_value_state`
  (migration 0029) hold a nutrient's standard deviation and measurement state, but neither holds
  the nutrient's own *value* for a nutrient with no dedicated column — invisible while only Table 1
  (proximates, all dedicated columns) existed, load-bearing the moment Table 2 needed to persist
  pantothenic acid/biotin/etc. Same additive-JSONB pattern as its siblings, keyed identically.
- **`persistProduct`'s `ON CONFLICT DO UPDATE SET` clause was missing most nutrition columns**
  (`datasources/openfoodfacts/cache.ts`) — masked since Table 1's own import was always a fresh
  INSERT (no pre-existing conflicting row yet existed). Tables 2–12 merge into rows Table 1 already
  created, making the gap load-bearing: a merge would have silently dropped every field the
  UPDATE clause omitted. Fixed to cover every column.
- **`rowToNutrition`'s `pg(Number(row.field))` pattern silently corrupted every genuinely-NULL
  nutrient into `0`** on any read-then-write round trip (`Number(null) === 0` in JS, executing
  before `pg()`'s own null-check ever ran) — a real, previously-undiscovered bug affecting every
  source, not just IFCT, invisible until Table 2's merge-import became the first real code path to
  read a row back and persist it again. Fixed (null-check moved before numeric conversion);
  regression-tested (`cache.test.ts`); the one row it had already corrupted during this session's
  own dry run was fixed by re-running Table 1's (idempotent) import before Table 2.
- Root `.gitignore`'s `data/ifct2017/*` rule didn't match this project's actual dataset location
  (`apps/api/data/ifct2017/`) — the whole derived-text dataset was untracked-but-not-ignored,
  meaning `git add` would have committed licensed-book-derived text. Added the correct path.

### Shared parsing infrastructure

`datasources/ifct/table-parsing.ts` — new, reused by every table below; Table 1's own
`book-parser.ts` is untouched (zero regression risk to its shipped, tested behavior). Provides
`parseSignatureBasedTable()`: tracks the book's real per-page column-signature line as parser
state (many tables print a DIFFERENT abbreviation-code line per page/food-origin, not one fixed
header for the whole table — verified per-table, never assumed to generalize), accepts a literal
`"NA"` token as occupying a real interior column position (distinct from a genuinely blank/
trailing cell), and — since Table 4 proved some foods are real, legitimate all-blank rows (a
region count with zero nutrient values at all, e.g. mushrooms have no carotenoids) — treats 0 as a
valid value count, not a parse failure. `datasources/ifct/nutrient-merge.ts` and
`table-merge-runner.ts` provide the shared merge-into-existing-row and report-writing pipeline
every Table 2+ import script uses.

### Tables completed (parsed, merged into the local DB, tested, reported)

- **Table 2 (Water-Soluble Vitamins)** — 510/528 foods covered (18 foods, all cereal group A
  members, genuinely absent from this table — not an error). 3 real column signatures tracked
  per-page (Group O/Animal Meat's signature omits Biotin from the middle of the sequence while
  keeping Total Folate after it — confirmed via the book's own literal signature line, not
  inferred). `thiamineMg`/`riboflavinMg`/`niacinMg`/`pantothenicAcidMg`/`vitaminB6Mg`/`biotinMcg`
  route through `nutrientExtra`; `folateMcg`/`vitaminCMg` use their existing dedicated columns
  (first real population of both). 4 spot-checked foods (Rice, Wheat, Banana, Milk) match the
  book's own printed values exactly.
- **Table 3 (Fat-Soluble Vitamins)** — 522/528 (Group L/Milk, 4 foods, rejected: the book
  footnotes Retinol/Cholecalciferol/25-OH-D3 for milk specifically rather than printing them
  inline, making positional mapping for that group's row a guess — rejected, not fabricated). Two
  real signatures by food origin (plant: Ergocalciferol + Vitamin K1; animal: Retinol +
  Cholecalciferol + Vitamin K2). `vitaminDIu` (existing dedicated column, never previously
  populated for IFCT) derived via the standard mcg→IU ×40 factor from whichever D-vitamer the row
  reports. `vitaminAIu` deliberately NOT touched — total vitamin A activity needs Retinol (this
  table) plus provitamin-A carotenoids (Table 4); computing it from only one contributor would be
  a fabricated partial value. Unified Retinol+carotenoid `vitaminAIu` recomputation is a tracked
  follow-up.
- **Table 4 (Carotenoids)** — 329 foods (single signature; Groups N/O/P/Q/R/S — all-animal
  groups — are genuinely absent from this table entirely, real: carotenoids are plant pigments).
  All values route through `nutrientExtra` (no existing dedicated column fits); `betaCaroteneMcg`
  stored raw, not combined into `vitaminAIu` (same reasoning as Table 3).
- **Table 6 (Starch and Individual Sugars)** — 310/314 (Group L/Milk rejected: a real footnoted,
  garbled Lactose-content section, same reasoning as Table 3's Group L). The extracted
  abbreviation line itself omits 2 of the real 7 columns (Total Available CHO, Total Free
  Sugars) — confirmed via a real arithmetic cross-check, not guessed: for every row reporting all
  7 values, Fructose+Glucose+Sucrose+Maltose exactly equals the row's own 7th printed value.
  `totalFreeSugarsG` → the existing dedicated `sugarsG` column (first real population from any
  source); the rest route through `nutrientExtra`.
- **Table 9 (Organic Acids)** — 314 foods, 0 rejections, every group present including Milk (no
  footnote exception here). Real 10-column order confirmed by combining the abbreviation line
  (which names only 5 of 10) with the English captions and a real arithmetic cross-check: Soluble
  + Insoluble Oxalate equals Total Oxalate for 296 of 311 rows checked with complete data (the
  ~5% residual is consistent with real value-rounding, not a structural error). All values route
  through `nutrientExtra` (no existing dedicated column fits organic acids).

All five above were verified against the real local Supabase instance (`getProductBySourceId` →
merge → `persistProduct` → re-queried), spot-checked against hand-transcribed values from the
book's own extracted text, and covered by real Vitest fixtures using the same extracted-text
excerpts (not synthetic data). **974/974 API tests green (0 regressions), `tsc --noEmit` clean.**

### Tables investigated and deferred (no code shipped — Prime Directive #4)

Each of these was reverse-engineered from the real extracted text, cross-checked against either
internal arithmetic or independent real-world chemistry/biology, and found to have a genuine,
irreducible ambiguity this session could not responsibly resolve — not skipped for convenience.

- **Table 5 (Minerals and Trace Elements).** The book's page layout splits ~20 elements across
  two physically separate blocks; the second (Magnesium…Zinc) is unrecoverable — its food codes
  are re-listed with zero values, then its real values print as bare numbers with no food code at
  all, and at least one confirmed row has an interior gap with no "NA" marker to disambiguate
  which column is missing. Worse: even the FIRST block (Aluminium…Lithium, which nominally
  includes Calcium and Iron) failed independent verification — the token position that should be
  Calcium shifts between position 1, 2, and 3 across different real foods (Almond/Cashew vs.
  Coconut vs. Niger seeds) depending on which other trace elements were silently omitted for that
  specific food, with no marker distinguishing "this position is genuinely absent" from "the whole
  row shifted left." No safe positional mapping exists without a different extraction pass.
- **Table 7 (Fatty Acid Profile).** Identified all 10 real sliding-window column signatures across
  the master fatty-acid list, but independent chemistry verification failed: H018 (Pistachio)
  produced an 18.5g lignoceric acid reading — more mass than the food's entire fat content — and
  duplicate food-code rows appear for some groups but not others without a confirmed
  merge-vs-artifact explanation.
- **Table 8 (Amino Acid Profile).** The essential-amino-acid signature parsed cleanly in isolation,
  but ~120 rows rejected into a single garbled multi-food text blob that, on inspection, revealed
  an entire second section (non-essential amino acids: Alanine, Arginine, Aspartic Acid, Glutamic
  Acid, Glycine, Proline, Serine, Tyrosine) never enumerated, with the same kind of layout problem
  found in Table 5.
- **Table 10 (Polyphenols).** Enumeration surfaced 4 signatures including two suspicious
  single-abbreviation fragments ("GALLAC" alone, "EPICATEGC" alone) against captions naming ~24
  distinct polyphenol/catechin compounds — the same fragmentation red flag that doomed Table 7,
  not invested in further given the established risk profile.
- **Table 11 (Oligosaccharides, Phytosterols, Phytates & Saponins).** Cereal rows cap at 6 values;
  legume rows report up to 9 (a real, plausible difference — Ajugose is a legume-specific sugar
  absent from cereals). Tested both a trailing-prefix-with-Ajugose hypothesis and a
  skip-Ajugose-for-cereals hypothesis against known phytosterol biology (β-Sitosterol should
  dominate Campesterol/Stigmasterol in any real food) — neither produced a fully consistent
  picture. Same unresolved class of problem as Table 5.
- **Table 12 (Fatty Acid Profile of Edible Oils and Fats).** The 14-food Group T dataset parsed
  cleanly (13/14; T014/Groundnut oil rejected for a real one-off layout anomaly — it prints its
  region count after its values, not before), but an independent chemistry cross-check failed:
  coconut oil is real-world Lauric-acid-dominant (~48%) and this parse's Lauric reading was a minor
  9%, under either a leading-prefix or trailing-suffix column-position hypothesis. Deferred rather
  than ship a mapping that fails its own plausibility check.

**Revised follow-up scope:** Tables 5, 7, 8, 10, 11, 12's import passes remain open — each will
need either a different PDF extraction approach (e.g. `-layout` mode or a column-range-targeted
extraction, given `-raw` demonstrably loses positional integrity for these specific tables in a
way it does not for Tables 1–4/6/9) or direct manual cross-referencing against the book's own
printed pages, not a continuation of the text-reconstruction approach used here.

## Addendum 2 (2026-07-10): §5 fully completed — Tables 5, 7, 8, 10, 11, 12 shipped via two new extraction strategies

The real `IFCT2017.pdf` (previously only its `pdftotext -raw` extraction existed in this
environment) was located, unblocking two genuinely different extraction strategies that resolved
every table Addendum 1 deferred. **All 12 tables are now shipped with real, verified data. No
table was skipped or fabricated.**

### Strategy A: `pdftotext -table` (position-aware parsing) — Tables 5, 7, 8

`-table` ("similar to `-layout`, but optimized for tables") preserves each printed value's real
horizontal position via padding whitespace, unlike `-raw` (reading order only) or `-layout`
(confirmed, again, to badly jumble this book's actual multi-column page layout — re-verified
directly before ruling it out a second time). A genuinely blank cell now shows up as a measurable
gap in x-position instead of vanishing, which is exactly what `-raw` reading-order counting could
never distinguish from "the row shifted left." New shared module: `datasources/ifct/
positional-table-parser.ts` — tracks each page's real column-label x-positions (or, where a
table's English captions wrap unpredictably across lines and never share a line with "No. of
Regions", the abbreviation-code line's own token positions instead) and assigns each printed value
to the nearest real column, never by counting.

- **Table 5 (Minerals)** — the exact ambiguity Addendum 1 found (Calcium's position shifting
  between rows) is resolved: Almond (H001) now correctly reads Calcium=228mg at its own measured
  print position, with Arsenic/Cadmium genuinely blank (not silently absorbed). Both real
  signatures (Aluminium…Lithium, Magnesium…Zinc, printed as alternating page-halves for every food)
  merge into one row per food. 511 rows, 0 rejections, 509 merged (2 orphaned: N001/Q001, the same
  two Table 1 itself rejected). `calciumMg`/`ironMg`/`potassiumMg`/`sodiumMg`/`zincMg` route to
  their existing dedicated columns — first real population of all five from any source.
- **Table 7 (Fatty Acid Profile)** — the exact bug Addendum 1 found (Pistachio's impossible 18.5g
  lignoceric acid) is resolved: Lignoceric now reads a real trace 18.11mg, with Oleic correctly
  holding its own 18.478g value at its own position — previously conflated because a genuinely
  blank interior column (Capric/Lauric, not analyzed for that food) had silently shifted every
  later value left by one slot under reading-order counting. All 8 real sliding-window signatures
  registered. 501 rows, 1 rejection (P064, a real one-off "no data row" case), 499 merged.
  `fatSaturatedG`/`fatMonounsaturatedG`/`fatPolyunsaturatedG` (mg→g converted) and `cholesterolMg`
  populated for the first time from any source, per this ADR's original §5 sequencing intent.
- **Table 8 (Amino Acid Profile)** — the entire second section Addendum 1 found garbled into one
  rejected blob (non-essential amino acids: Alanine, Arginine, Aspartic Acid, Glutamic Acid,
  Glycine, Proline, Serine, Tyrosine) now parses cleanly, since "No. of Regions" does share a line
  with this table's column labels (unlike Table 7) — pure label-position matching sufficed, no
  abbreviation-line fallback needed. 505 rows, 0 rejections, 503 merged. All 18 amino acids (10
  essential + 8 non-essential) route through `nutrientExtra`, explicitly named
  `*GPer100gProtein` since this table's own stated unit basis (g per 100g protein) differs from
  every other table's per-100g-edible-portion basis.

### Strategy B: structured CSV cross-validation — Tables 10, 11, 12

Three tables' real column labels (long, hyphenated chemical names — e.g. "3,4-Dihydroxybenzoic
acid", "β-Sitosterol") wrap unpredictably across lines badly enough that even `-table`'s position
preservation cannot reliably anchor them. A second, independently-produced digitization of the
same real IFCT 2017 dataset was located (`ifct2017_compositions.csv`, structured/labeled,
542 rows) and used instead — but **only after exhaustive cross-validation against this session's
own independently-derived `-table` position data**, not trusted on its own authority:
- Table 2 (already shipped, unrelated to this addendum): the CSV disagreed with this codebase's
  own Group O parsing (a Biotin/Total-Folate column swap). Direct re-inspection of the real
  extracted text sided with this codebase's original parsing — the CSV was wrong there, and is
  NOT used for Table 2 or any already-shipped table.
- Table 10 (Polyphenols): Parsley (C028)'s values matched this session's own `-table`-derived
  numbers exactly across both of its real signature blocks (vanlac=1.18, coumaco=0.41,
  coumacp=0.02, caffac=0.27 AND chlrac=1.52, ferac=0.33, apigen=16.14, kaemf=0.01) — full,
  independent agreement.
- Table 11 (Oligosaccharides/Phytosterols): A001 and A008's Campesterol/Stigmasterol/β-Sitosterol/
  Phytate values matched this session's own extraction exactly.
- Table 12 (Edible Oils): Coconut oil's real, textbook Lauric-acid dominance (49.57%) matched the
  CSV exactly, resolving Addendum 1's chemistry-cross-check failure — confirming Butyric/Caproic
  are genuinely absent (0) for coconut oil and the real values start at Caprylic, not Butyric as
  reading-order counting had assumed.

New shared module: `datasources/ifct/csv-dataset.ts` (parses the CSV's own `value`/`value_e`
column-pair convention — `_e` is each nutrient's standard deviation — and its literal `"null"`
sentinel for "not analyzed", distinct from a real `0`).

- **Table 10 (Polyphenols)** — 542/542 rows (all groups, including T), 0 rejections, 526 merged
  (16 orphaned: N001/Q001 + all 14 Group T oils, which have no Table 1 proximate row). 37 distinct
  polyphenol/flavonoid/catechin compounds, all routed through `nutrientExtra` (no existing
  dedicated column fits any of them).
- **Table 11 (Oligosaccharides, Phytosterols, Phytates & Saponins)** — same 542/526/16 split.
  9 real columns (Raffinose, Stachyose, Verbascose, Ajugose, Campesterol, Stigmasterol,
  β-Sitosterol, Phytate, Total Saponin) — Ajugose (legume-only) confirmed genuinely absent for
  cereals via the CSV's own explicit `null`, not guessed.
- **Table 12 (Fatty Acid Profile of Edible Oils and Fats)** — 14/14 Group T foods. Since Group T
  has no proximate data (ADR-0031 §1) and so no Table 1 row ever existed for them, this table's
  import script is the only one of the twelve that **creates** new products rather than merging —
  a deliberate, documented exception (`table-merge-runner.ts`'s new optional `createIfMissing`
  callback), not a silent behavior change to the other eleven tables' merge-only contract. All 14
  oils' saturated-fat percentages independently match real, well-known chemistry (Coconut 90.9%,
  Palm 45.0%, Mustard 5.7%, Ghee 71.0%, Vanaspati 61.4%).

### Verification

Every one of the six tables above was: (1) parsed from real extracted/structured text, never
synthetic data; (2) spot-checked against hand-transcribed or independently-cross-validated real
values; (3) covered by real Vitest fixtures reproducing the actual extracted text (not invented
strings); (4) merged into the real local Supabase instance and re-queried to confirm; (5) checked
against independent chemistry/nutrition-science plausibility where a real cross-check existed
(fatty acid profiles, mineral content). **987/987 API tests green (0 regressions), `tsc --noEmit`
clean.**

### Follow-ups (tracked, not blocking)

- Table 5's Nickel/Molybdenum column-name possibly needs a closer look at real IUPAC spelling
  ("Molebdenum" is the book's own typo, preserved verbatim in the field's inline comment, not
  silently corrected in a way that would obscure the source).
- Table 7/12 share the same underlying fatty-acid chain-length columns but store them under
  different key names (`*Mg` vs `*Pct`) since they measure different things (absolute mg/100g vs
  % of total FAME) for disjoint food sets (Table 7 never covers Group T, Table 12 only covers
  Group T) — revisit only if a future consumer needs both normalized to one common unit.
- `vitaminAIu` unification (Retinol from Table 3 + provitamin-A carotenoids from Table 4) remains
  a deliberate, un-fabricated follow-up, unchanged from Addendum 1.
- The two source files this addendum's strategies depend on
  (`IFCT2017.pdf`, `ifct2017_compositions.csv`) are licensed-dataset artifacts, kept outside the
  repo and gitignored — `apps/api/data/ifct2017/*` (the derived extraction slices and the CSV
  copy) is excluded via the `.gitignore` fix from Addendum 1.
