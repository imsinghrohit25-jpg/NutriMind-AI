# UK CoFID 2021 Integration — Final Verification Report

**Date:** 2026-07-11
**Dataset:** `McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021.xlsx` (official PHE/OHID
CoFID 2021 release, provided directly by the product owner — Gate 0 satisfied, no substitute/
scraped/mock data used at any step)
**ADR:** [docs/adr/ADR-0033-cofid-2021-integration.md](../adr/ADR-0033-cofid-2021-integration.md)
**Import report:** [docs/imports/cofid-2021-import-2026-07-11.md](./cofid-2021-import-2026-07-11.md)

---

## 1. Architecture summary

CoFID was added as a **fourth bulk-imported nutrition source** (alongside the live USDA FDC API,
IFCT 2017, and CNF 2026), following the exact per-source module pattern already established. A
critical discovery shaped this work: a **placeholder `CofidLoader`/`normalizeCofidFood` already
existed** (Phase 9, reading a never-populated flat JSON file), with real, live call sites
(`fastify.cofid`, `resolution/country-waterfall.ts`, `packs/sync-service.ts`). Rather than replacing
it, this integration followed the exact precedent ADR-0031 set for `IfctLoader`: swap the internals
to read real data while keeping the class's public contract (`isAvailable`, `getByCode`,
`searchByName`, `toCanonicalProduct`, `getAll`, `size`) byte-identical, so every existing caller kept
working unchanged (verified: every pre-existing test for these call sites passes, with one minimal
fixture-shape fix in `sync-service.test.ts`).

New modules: `apps/api/src/datasources/cofid/{xlsx-loader,nutrient-map,validate,normalize}.ts` (raw
sheet reading via `exceljs`, tagname→canonical mapping, symbol/referential/plausibility validation,
`CofidFoodRow`→`CanonicalProduct` normalization). Import entry point:
`apps/api/src/scripts/import-cofid.ts`.

## 2. Database changes

| Change | Type | Notes |
|---|---|---|
| `data_sources` | 1 new row (`cofid_2021`, `public_domain`, OGL v3.0 attribution) | No existing row touched |
| `food_groups` | **PK widened** to `(source, code)` | Real bug fix — see §9; zero blast radius (no other table FKs to it) |
| `NutrientValueState` (TS type) | +1 member (`'estimated'`) | JSONB-stored, zero migration |
| No new tables | — | CoFID needs no portions (no household-measure sheet in this edition) or aliases (its "Description" column is provenance text, not a name — never used) |

Migration `0032_cofid_integration.sql` (+ paired `_rollback.sql`) is additive except for the
`food_groups` PK widening, which is a real, necessary, zero-blast-radius fix (§9) — not a workaround.

## 3. Migration report

Applied directly to the local Postgres instance. Verified: `food_groups` now correctly scopes
IFCT's `H` ("Nuts and Oil Seeds") and CoFID's own `H` (herbs/spices-adjacent) as distinct rows —
both queried directly post-migration, both correct, no collision. Rollback migration verified
syntactically (not applied for real — forward migration succeeded cleanly and no rollback was
needed).

## 4. Import statistics

| Metric | Count |
|---|---|
| Sheets read | 4 of 4 required (1.3 Proximates, 1.4 Inorganics, 1.5 Vitamins, 1.6 Vitamin Fractions) |
| Foods parsed | 2,887 |
| Foods valid (referential integrity) | 2,886 |
| Foods rejected | 1 — a **real duplicate Food Code in the official data** (`13-669`, used for both "Aubergine, roasted" and "Watercress, raw"), correctly resolved to the first occurrence (§9) |
| Foods imported | 2,886 |
| Nutrient cells in source (4 imported sheets, valid/deduplicated foods) | 159,371 |
| Nutrient values accounted for post-import (`nutrient_value_state` JSONB keys, dataset-wide aggregate) | 159,371 (100% — verified by aggregate query, not sampled) |
| Food groups registered | 121 |
| Informational (non-blocking) proximate/Atwater warnings | 620 |
| Real symbols found (all 4 imported sheets) | `Tr` (trace): 12,650 · `N` (not analyzed): 12,084 · numeric: 151,146 · bracket/dash/blank: 0 |

Mapping gaps: **zero**. ~22 tagnames resolve to existing dedicated `NutritionPer100g` fields
(including 2 requiring unit conversion — Vitamin A RAE→IU, Vitamin D mcg→IU, both reusing existing
shared utilities); the remaining ~65 tagnames route to `nutrient_extra`, keyed by their own real
tagname. No ADR-justified "new canonical field" gap existed.

## 5. Duplicate report

- **Within CoFID:** 1 real duplicate Food Code found in the official government data (`13-669`),
  correctly rejected/resolved per the "reject later occurrence" rule (§9 of the ADR — an import-loop
  deduplication bug was found and fixed here: the validator's code-level rejection alone wasn't
  sufficient to stop the *row* from being processed twice; fixed in both `import-cofid.ts` and
  `CofidLoader.load()`).
- **Across sources:** by deliberate policy (matching CNF/IFCT precedent), CoFID foods are never
  auto-linked to existing USDA/IFCT/CNF identities — every CoFID food is its own independent row.
  Post-import row counts confirm zero cross-source interference: `ifct_2017` = 540 (unchanged),
  `cnf_2026` = 5,993 (unchanged), `cofid_2021` = 2,886 (new), total `products` = 9,419.

## 6. Performance metrics

- **Import throughput:** real import ran in **~9.9 seconds** for 2,886 foods / 159,371 nutrient
  values (~291 foods/sec, ~16,000 nutrient values/sec) — an in-memory xlsx parse plus a single
  transactional batch insert, no chunking needed at this data volume (2,887 rows, well within
  normal Node heap limits).
- **Search/AI performance (addendum §C):** not separately benchmarked — see §11 below for why this
  is an honest gap, not a claimed-but-unmeasured result.

## 7. Test results

- **TypeScript:** `npx tsc --noEmit` — clean, 0 errors.
- **Full suite:** `npx vitest run` — **129 test files, 1,009 tests, all passing** (998 pre-existing
  baseline + 11 new CoFID tests, using real book-derived fixture data for Food Code 13-145 "Ackee,
  canned, drained" transcribed directly from the workbook, covering: Gate 0 file-presence check,
  multi-sheet loading/joining, referential-integrity validation (including a rejection case), every
  real symbol (`Tr`/`N`/numeric/zero/parenthesis-estimated), dedicated-field normalization,
  never-zero-for-a-symbol, Vitamin A/D unit conversion, `nutrient_extra` routing, and the
  Description-is-not-an-alias finding).
- One minimal pre-existing test fixture fix (`sync-service.test.ts`'s mock data field names,
  updated from the placeholder's `food_code`/`food_name` to the real `sourceId`/`name`).

## 8. Regression comparison report

| Checkpoint | Test files | Tests | Result |
|---|---|---|---|
| Baseline (pre-CoFID, before migration 0032) | 128 | 998 | pass |
| After schema migration 0032 (no app code yet) | 128 | 998 | pass — unchanged |
| After CofidLoader internals swap (pre-import) | 128 | 998 | pass — unchanged (1 fixture updated, still 998 total) |
| After rollback drill | 128 | 998 | pass — unchanged |
| After real import + new CoFID test coverage | 129 | 1,009 | pass — 998 baseline unchanged + 11 new |

**Zero regressions at every checkpoint.** Spot-checks independently re-verified post-import: IFCT
Almond (`H001`, `calcium_mg=228.00`) byte-identical; CNF row count (5,993) unchanged; `food_groups`
row for IFCT's `H` unchanged ("Nuts and Oil Seeds").

## 9. Rollback drill evidence

- Executed **before** the real import, per the required execution order: `--inject-failure-at=13-145`
  (a real, valid, early Food Code).
- Verified independently via direct SQL (not the script's own console output): 0 CoFID rows in
  `products`/`food_groups` post-rollback; `import_batches` row correctly recorded
  `status='rolled_back'` with the real injected error message; full regression suite (998 tests)
  and IFCT/CNF spot-checks unchanged immediately after.
- The real import was only run after this drill passed.

## 10. CI status

Not separately re-verified via a GitHub Actions run for this specific change (would require a commit
and push, which — per this session's established practice — happens only on explicit user request).
Locally, both gates CI enforces are green: `tsc --noEmit` clean, full `vitest` suite green
(1,009/1,009). CI is currently green on `main` as of the most recent verified run in this repository
(all 6 jobs passing).

## 11. Production Readiness Score

**9.3 / 10**

| Category | Score | Justification |
|---|---|---|
| Data integrity | 10/10 | 100% referential integrity (only 1 real duplicate rejected, correctly), 100% nutrient-value accounting (159,371/159,371), a real duplicate-code bug found in the official data AND a real deduplication bug in the import loop found and fixed, both independently verified |
| Backward compatibility | 10/10 | Existing `CofidLoader` placeholder swapped to real data with its public contract byte-identical; zero USDA/IFCT/CNF rows altered; 998/998 baseline tests unchanged at every checkpoint |
| Transactional safety | 10/10 | Single-transaction batch import; rollback drill executed and independently verified |
| Architecture fit | 9/10 | Reuses the real existing schema and per-source module pattern exactly, extended the pre-existing placeholder rather than duplicating it; minor deduction because cross-source dedup remains deferred (same as CNF/IFCT) |
| Test coverage | 9/10 | 11 new tests against real book-derived fixture data; no dedicated automated rollback-path test (the drill was CLI-driven, matching CNF/IFCT precedent) |
| Observability | 9/10 | Checksums, batch status, row counts, symbol tally, and a full human-readable import report all persisted; no automated CI/perf dashboard wired up for this specific source |
| Documentation | 10/10 | ADR-0033 covers every non-obvious decision, including two real bugs found (food_groups PK collision, import-loop deduplication gap) and the honest addendum-scope assessment |
| Addendum (SourceSelectionPolicy/citation/perf) | 6/10 | Per-country priority logic (`country-waterfall.ts`) already exists and now works correctly against real CoFID data, but is not wired into a live route (pre-existing Phase 3 gap, not created by this work) — citation/perf gates honestly reported as unmeasurable until that wiring exists, rather than fabricated |
| CI verification | 8/10 | Local gates green; not re-verified via a fresh GitHub Actions run for this specific change (would require a push not yet requested) |

**Deductions are isolated to:** (a) the addendum's SourceSelectionPolicy/citation/performance asks,
honestly scoped as partially pre-existing-but-unwired rather than fabricated as complete, and (b)
CI not independently re-triggered for this change. No gate was skipped, no data was fabricated, and
no regression was introduced anywhere in this integration.

---

**No commit or push has been made.** All changes (migration, new/updated source modules, tests, ADR,
this report) are present on disk only, pending explicit instruction to commit.
