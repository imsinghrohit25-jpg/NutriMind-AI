# CNF 2026 Integration — Final Verification Report

**Date:** 2026-07-10
**Dataset:** `cnf_fcen_all-files-data_2026.zip` (official Health Canada CNF 2026 release, provided
directly by the product owner — Gate 0 satisfied, no substitute/scraped/mock data used at any step)
**ADR:** [docs/adr/ADR-0032-cnf-2026-integration.md](../adr/ADR-0032-cnf-2026-integration.md)
**Import report (checksums + counts):** [docs/imports/cnf-2026-import-2026-07-10.md](./cnf-2026-import-2026-07-10.md)

---

## 1. Architecture summary

CNF was added as a **fourth independent nutrition source** (alongside the live USDA FDC API,
the licensed IFCT 2017 book import, and Open Food Facts), following the exact per-source module
pattern already established by IFCT/USDA (`client|loader.ts` + `normalize.ts`, no shared
`NutritionSource` interface exists in this codebase today, so none was introduced for CNF alone —
see ADR-0032 §2 for why that would be scope beyond what this integration needs).

New module: `apps/api/src/datasources/cnf/` — `csv-loader.ts` (hand-written CSV parser: BOM
stripping, quoted fields, embedded commas/accents), `types.ts`, `loader.ts` (joins all 7 relational
CSVs by numeric ID + SHA-256 checksums), `nutrient-map.ts` (23 CNF codes → existing dedicated
`NutritionPer100g` fields), `normalize.ts` (CNF row → `CanonicalProduct`), `validate.ts`
(referential-integrity hard gate + informational plausibility warnings), `persist.ts` (new-table
inserts). Import entry point: `apps/api/src/scripts/import-cnf.ts`.

Zero existing files were deleted, renamed, or had their business logic altered. USDA's and IFCT's
normalizers, validators, and shared utilities (`derived.ts`, `units.ts`) are reused, unmodified, by
reference — never copy-pasted or forked.

## 2. Database changes

All additive; see migration `supabase/migrations/0031_cnf_integration.sql` (paired with a tested
`_rollback.sql`):

| Change | Type | Notes |
|---|---|---|
| `data_sources` | 1 new row (`cnf_2026`, `public_domain`) | No existing row touched |
| `food_groups` | reused as-is | CNF's 23 numeric group codes inserted; no schema change |
| `product_portions` | **new table** | Generic household/yield/refuse measure storage — first source needing >1 portion per product |
| `product_aliases` | **new table** | Generic multi-language/alternate/scientific name storage — first bilingual source |
| `import_batches` | **new table** | Per-batch audit trail (checksums, status, row counts, error message) |

All new tables carry RLS (`read-all-authenticated` + `service-role-write`) matching the existing
IFCT/USDA convention exactly. No column was added to, and no row was updated in, `products` or
`product_nutrition` for any pre-existing source.

## 3. Migration report

- `0031_cnf_integration.sql` applied directly to the local Docker Postgres instance
  (`supabase_db_nutrimind`). Contains only `CREATE TABLE IF NOT EXISTS`, `INSERT ... ON CONFLICT DO
  NOTHING`, and RLS policy statements — no destructive DDL.
- `0031_cnf_integration_rollback.sql` drops the 3 new tables + their policies and removes the
  `cnf_2026` `data_sources` row. Verified syntactically valid via a `BEGIN;...ROLLBACK;` dry-run
  wrapper; never applied for real (not needed — forward migration succeeded cleanly).
- Full regression suite (987 tests, pre-CNF baseline) passed unchanged immediately after applying
  the forward migration and before any CNF application code existed.

## 4. Import statistics

| Metric | Count |
|---|---|
| Files loaded (checksummed) | 8 of 8 required CNF files |
| Foods parsed | 5,993 |
| Foods valid (referential integrity) | 5,993 (100%) |
| Foods rejected | 0 |
| Foods imported | 5,993 |
| Nutrient value rows in source (`Nutrient_Amount.csv`) | 565,409 |
| Nutrient values accounted for post-import (dedicated columns + `nutrient_extra`) | 565,409 (100% — verified by dataset-wide aggregate query, not sampled) |
| Portions imported | 29,868 |
| Aliases imported (French translations, alternates, scientific names) | 10,542 |
| Food groups registered | 23 |
| Informational (non-blocking) proximate/Atwater warnings | 1,179 (see ADR-0032 §4 for why these don't reject real government data) |

Mapping gaps: **zero**. Every nutrient resolves either to an existing dedicated
`NutritionPer100g` field (23 codes) or to `nutrient_extra` keyed by its own real INFOODS Tagname
(the ~147 remaining reported nutrients, plus 6 codes with a genuinely blank Tagname in the source
data, keyed by `cnf_<code>` — see the tagname-collision bug fix below). No ADR-justified "new
canonical field" gap existed; CNF's own nutrient set is fully covered by the existing dictionary
plus the sidecar mechanism ADR-0031 already established.

## 5. Duplicate report

- **Within CNF:** 0 duplicate `Food_Code` values across 5,993 real foods (hard-rejected if found;
  none were).
- **Across sources:** by deliberate, documented design decision (ADR-0032 §5), CNF foods are
  **never** auto-linked or merged into existing USDA/IFCT product identities — every CNF food is
  its own independent row (`source='cnf_2026'`). Cross-source food deduplication is an explicit,
  tracked follow-up, not attempted in this pass, per the governing prompt's own "a false split is
  safe; a false merge corrupts data" guidance.
- Post-import row counts confirm no cross-source interference: `usda_fdc` products = 0 (live-API
  cached source, unaffected by this batch import), `ifct_2017` products = 540 (unchanged from
  before CNF work began), `cnf_2026` products = 5,993, total `products` = 6,533.

## 6. Performance metrics

- **Import throughput:** real import ran start (`2026-07-10 20:04:34 UTC`) to completion
  (`2026-07-10 20:06:15 UTC`) — **~101 seconds** for 5,993 foods / 565,409 nutrient values / 29,868
  portions / 10,542 aliases inside one transaction (~59 foods/sec, ~5,600 nutrient rows/sec).
- **Memory:** the loader streams/joins via in-memory `Map`s sized to the dataset (5,993 foods,
  173 nutrients, 1,494 measures) — well within normal Node heap limits for a batch script; no
  chunking was required at this data volume.
- **Search p95:** not separately re-benchmarked as part of this integration — there is no existing
  automated search-latency benchmark harness in this codebase to compare against. CNF rows are
  read through the exact same `products`/`product_nutrition` query paths USDA/IFCT already use (no
  new indexes, no new query shape), so no latency regression is expected from the read path itself;
  this is a gap worth flagging rather than a verified number, and is called out explicitly here
  rather than fabricated.

## 7. Test results

- **TypeScript:** `npx tsc --noEmit` — clean, 0 errors.
- **Full suite:** `npx vitest run` — **128 test files, 998 tests, all passing.**
  - 987 tests are the pre-existing baseline (unchanged).
  - 11 new CNF tests added: `cnf-csv-loader.test.ts` (4 tests — BOM stripping, quoted-comma
    fields, French accents, blank-field handling, all using real `Food_Name.csv` excerpt lines) and
    `cnf-integration.test.ts` (7 tests — full 7-file real fixture set for food code 2 "Cheese
    souffle," covering loader joins, referential-integrity validation including a rejection case,
    dedicated-field normalization, French alias capture, and household/refuse portion conversion).

## 8. Regression comparison report

| Checkpoint | Test files | Tests | Result |
|---|---|---|---|
| Baseline (pre-CNF, before migration 0031) | 126 | 987 | pass |
| After schema migration 0031 (no app code yet) | 126 | 987 | pass — unchanged |
| After rollback drill (injected failure at Food_Code 4077) | 126 | 987 | pass — unchanged |
| After real import + CNF test coverage added | 128 | 998 | pass — 987 baseline tests unchanged + 11 new |

**Zero regressions at every checkpoint.** A spot-checked IFCT fixture (Almond, `H001`,
`calcium_mg=228.00`) was independently confirmed byte-identical before and after the CNF rollback
drill and after the real import.

## 9. Rollback drill evidence

- First attempt (`--inject-failure-at=500`) used a non-existent `Food_Code` (CNF's numbering has
  real gaps) — the injected failure never fired, and the script completed a full real import
  instead of testing rollback. Caught by checking actual database state rather than trusting the
  script's own success message; the accidental import was fully deleted
  (`DELETE FROM products/food_groups/import_batches WHERE source='cnf_2026'`), verified 0 rows
  across all affected tables.
- Corrected drill (`--inject-failure-at=4077`, a real, valid mid-dataset food) properly threw
  mid-transaction. Verified independently via direct SQL (not the script's self-report):
  - **0** CNF rows remained in `products`, `product_nutrition`, `product_portions`,
    `product_aliases`, or `food_groups` after rollback.
  - `import_batches` row recorded `status='rolled_back'` with the real injected error message.
  - Full USDA/IFCT regression suite (987 tests) passed unchanged immediately after.
  - IFCT fixture spot-check (Almond, `H001`) confirmed unchanged.
- The real import was only run **after** this drill passed, per the required execution order.

## 10. CI status

GitHub Actions status could not be checked in this session — the `gh` CLI is unauthenticated in
this environment (no `GH_TOKEN`/`GITHUB_TOKEN`, no prior `gh auth login`). This is a pre-existing,
unrelated open item from earlier in this session, not a consequence of the CNF work. Locally, both
gates CI would be expected to run — `tsc --noEmit` and the full `vitest` suite — are green (see
§7). Recommend the user run `gh auth login` (or confirm CI status manually in the GitHub UI) to
close this out; I have not fabricated a CI result.

## 11. Production Readiness Score

**9.5 / 10**

| Category | Score | Justification |
|---|---|---|
| Data integrity | 10/10 | 100% referential integrity (0/5,993 rejected), 100% nutrient-value accounting (565,409/565,409), 0 duplicate food codes, tagname-collision bug found and fixed with dataset-wide verification |
| Backward compatibility | 10/10 | Zero existing files/tables/rows altered; 987/987 baseline tests unchanged at every checkpoint; IFCT/USDA byte-identical spot-checks |
| Transactional safety | 10/10 | Single-transaction batch import; rollback drill executed and independently verified (not simulated) |
| Architecture fit | 9/10 | Reuses the real existing schema and per-source module pattern exactly; minor deduction because cross-source dedup and search-priority-by-country are deferred, documented follow-ups rather than fully wired |
| Test coverage | 9/10 | 11 new tests against real (not synthetic) fixture data covering parser, joins, validation, normalization, and portions; no dedicated rollback-path automated test (the drill was manual/CLI-driven) |
| Observability | 9/10 | Checksums, batch status, row counts, and a full human-readable import report are all persisted; no automated CI/perf dashboard wired up yet |
| Documentation | 10/10 | ADR-0032 covers every non-obvious decision (schema mismatch resolution, real file-structure discovery, tagname-collision bug, validation-strictness rationale, never-auto-merge policy) |
| CI verification | 7/10 | Local tsc/vitest gates are green; actual GitHub Actions run status unverified this session due to unauthenticated `gh` CLI (pre-existing, unrelated blocker) |

**Deductions are isolated to:** (a) CI status not independently confirmed via GitHub Actions itself
(local gates are green), and (b) two explicitly deferred, documented follow-ups (cross-source
dedup, country-priority search ranking) that were out of scope for a safe first pass per the
governing prompt's own guidance. No gate was skipped, no data was fabricated, and no regression was
introduced anywhere in this integration.

---

**No commit or push has been made.** All changes (migration, new source module, tests, ADR, this
report) are present on disk only, pending explicit instruction to commit.
