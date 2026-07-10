# IFCT 2017 Dataset Format

**Source:** ICMR-National Institute of Nutrition, Hyderabad — Indian Food Composition Tables 2017
(T. Longvah, R. Ananthan, K. Bhaskarachary, K. Venkaiah).
**License:** Licensed from ICMR-NIN (`licensed_restricted`) — written permission for electronic
storage/serving confirmed 2026-07-10 (see ADR-0031). Not redistributable.
**Real file:** the official book, delivered as a PDF (~500 pages, 528 foods × ~151 nutrients across
12 tables + a supplementary 13th for edible oils). This superseded a placeholder 25-column CSV
format this file used to document — no such CSV was ever actually delivered; it was a stand-in for
"whatever arrives," per `docs/DATA_SOURCES.md`'s Risk R-01. See ADR-0031 for the full story.

## Real structure, discovered by direct inspection (not assumed)

- 20 food groups (letter-coded, A–T), 528 foods in groups A–S; group T (Edible Oils and Fats, 14
  entries) has no proximate/vitamin/mineral data — it is covered only by Table 12's fatty-acid
  profile. Seeded into the `food_groups` table (migration 0029).
- 12 nutrient tables: Proximates & Dietary Fibre (1), Water-Soluble Vitamins (2), Fat-Soluble
  Vitamins (3), Carotenoids (4), Minerals & Trace Elements (5), Starch & Individual Sugars (6),
  Fatty Acid Profile (7), Amino Acid Profile (8), Organic Acids (9), Polyphenols (10),
  Oligosaccharides/Phytosterols/Phytates/Saponins (11), Fatty Acid Profile of Edible Oils/Fats (12).
  Integrated incrementally, table-by-table (ADR-0031 §5) — as of this writing, **only Table 1 is
  integrated.**
- Energy is tabulated in kJ only (no separate kcal column); kcal is derived
  (`nutrition/derived.ts`'s `fillEnergyFields()`), same as any other source missing one of the pair.
- Each value may carry a standard deviation (regional-composite variability) and a value-state
  distinct from a plain missing value — see `NutrientValueState` in `canonical-model.ts`.

## Extraction method (real, verified — not assumed)

`pdftotext -layout` (the naive default) badly jumbles this document's real multi-column-per-page
layout — do not use it for any data value. `pdftotext -raw` (content-stream order) produces
correctly-ordered, one-row-per-food text and is the **only** extraction mode this integration
trusts. The encoding flag matters: without `-enc UTF-8`, the output is Latin-1 and every `±`
(standard-deviation marker) silently becomes a corrupt byte that fails to parse as a number —
found and fixed during Table 1's own development (ADR-0031).

```
pdftotext -raw -enc UTF-8 IFCT2017.pdf ifct2017_raw_utf8.txt
```

Each table's real text is then sliced out of that full dump between two content markers (the
table's own repeating "A CEREALS AND MILLETS" section start, which recurs once per table) — not by
page number, since the book's front matter makes PDF page numbers and printed page numbers diverge.
`book-parser.ts`'s own header comment documents Table 1's exact real column shapes (9/6/5, not
fixed per food group — a real, verified rule, not the addendum's assumption).

## File placement

```
data/
  ifct2017/
    IFCT2017.pdf                    ← the licensed source (gitignored)
    ifct2017_raw_utf8.txt           ← full pdftotext -raw -enc UTF-8 extraction (gitignored)
    table1_proximates_raw.txt       ← Table 1's sliced content, what IfctLoader.load() reads (gitignored)
    README.md                      ← acquisition instructions
```

## Parsing entry points

- `book-parser.ts`'s `parseTable1(rawText)` — Table 1 only, for now. Rejects (never guesses) a
  row whose value count doesn't match one of the three real shapes it discovered.
- `validate-table1.ts`'s `validateTable1(rows)` — proximate-sum + Atwater-energy hard bounds,
  reusing the existing `energyConsistencyNote()` (ADR-0007) for the soft note.
- `parser.ts`'s `table1RowToEntry(row)` — assembles the validated row into the same `IfctEntry`
  shape `loader.ts` has always exposed; every nutrient not covered by Table 1 stays `null`, never
  guessed from adjacent tables.
- `IfctLoader.load(datasetDir)` — reads `table1_proximates_raw.txt` from `datasetDir`, runs the
  above pipeline, and exposes `getImportReport()` (counts, rejections with reasons, warnings) for
  the real import script (`scripts/import-ifct-table1.ts`) to report on.
