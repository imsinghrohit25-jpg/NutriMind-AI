# ADR-0039: Premium Redesign — Wiring the Health Score Engine + Allergen Hard Gate into Resolve

## Status
Accepted (Phase 3).

## Context
Phase 3's brief (premium redesign master prompt) assumes the Product Result screen already shows
a live Health Score ring and Allergen Hard Gate that just need a visual/animation upgrade. Auditing
the actual code before building found otherwise:

- `apps/api/src/engines/score/engine.ts` (`computeHealthScore`) — a real, deterministic, fully
  regression-tested scoring engine (sodium/sugar/sat-fat/trans-fat/fibre/protein/NOVA) — existed
  and was never called by `/v1/resolve/barcode` or `/v1/resolve/name`.
- `apps/api/src/engines/allergen/detector.ts` (`detectAllergens`) + `fail-safe.ts`
  (`allergenFailSafe`) — same story: real, tested, unused by the resolve routes.
- `apps/mobile/lib/features/score/score_screen.dart` (`ScoreScreen`) and `.../safety_badges/
  safety_badges_widget.dart` (`SafetyBadgesWidget`) — real, complete presentation widgets that
  expected exactly this data shape — were never constructed anywhere with real data. `grep` across
  `lib/` confirmed each widget's only reference was its own definition file.

So today's production scan flow shows raw nutrition only: no score, no allergen warning — despite
the app's own consent/disclaimer screens (see `consent_screen.dart`) explicitly promising AI
nutrition analysis and allergen safety. This was flagged to the user mid-Phase-3 (AskUserQuestion)
before proceeding, since wiring a backend route is a bigger blast radius than the pure UI work in
Phases 0-2. User chose: wire it up for real, then redesign around real data.

## Decision
1. **`apps/api/src/routes/v1/resolve.ts`** gains three new pure, synchronous helper functions
   (`buildHealthScore`, `buildSafety`, refactored `buildDiseaseGuidance`) plus one shared
   `fetchProfileSlice` (one Supabase round-trip serving disease guidance, allergens, and — as
   before — nothing else). Both `/resolve/barcode` and `/resolve/name` responses now additionally
   carry `healthScore` (nullable — null only when the product has no nutrition at all) and
   `safety` (`{ allergenMatches, childWarnings, hasFailSafe, failSafeReason }`).
2. **No new business logic was written.** Every number/verdict in `healthScore`/`safety` comes
   from calling the pre-existing, already-tested engines with real inputs derived from the
   resolved `CanonicalProduct` and (when authenticated) the real `users_profiles` row. The resolve
   route is glue, not a new decision-maker.
3. **`ingredientsRawText` (a string) is passed as a single-element array** to both
   `computeHealthScore`'s NOVA classifier and `detectAllergens`, matching how those pure functions
   already `.join(' ')` any array they're given internally — not a new parsing step, just adapting
   the shape.
4. **Allergen matching for an anonymous caller checks every taxonomy allergen** (no profile to
   scope to) — this is `detectAllergens`'s own designed fallback (see its source), the safer
   default, not a gap introduced here.
5. **`ocrConfidence`/`parseQuality` are left at their "known-clean text" defaults (1.0/'high')**
   for both routes — `ingredientsRawText` here is structured DB text (OFF/IFCT/USDA), never an OCR
   extraction, matching the exact convention already documented in `agents/tools/allergen.ts`. The
   allergen fail-safe exists for label-OCR uncertainty, which doesn't apply to a barcode-resolved
   structured product.
6. **`childWarnings` is always `[]` from this route.** Child safety (`engines/child-safety/
   engine.ts`) requires a specific family member's age — that only has meaning in the Household/
   Family Guardian flow (`engines/cart/rollup.ts`), not a single generic product resolve. Left
   honestly empty rather than fabricating an age.
7. **Mobile side**: `ScanPipelineResult` gains `healthScore`/`safety` fields (threaded through
   from the resolve response, same pattern as the pre-existing `diseaseGuidance`);
   `BarcodeFlowResult` passes them to `ProductScreen`, which now renders a real animated Health
   Score ring (`AnimatedNutrientRing`, tap → the existing `ScoreScreen` for the full breakdown —
   reused, not rebuilt) and `SafetyBadgesWidget` at the top of the screen with a one-shot heavy
   haptic when an unsuppressible allergen or fail-safe warning is present. `ScoreScreen`'s own
   gauge was upgraded from a raw `CircularProgressIndicator` to the same `AnimatedNutrientRing`
   (governance: no widget should hand-roll what the design system already provides).
8. **Nutrition table → animated `NutrientBar`s** (new design-system component) against a standard
   %DV-style 2000-kcal reference (same public convention as every nutrition label, consistent with
   ADR-0038's precedent) — display-only reference; never affects the real engine's score.

## Testing
`apps/api/src/routes/v1/__tests__/resolve.test.ts` — extended (not replaced) with cases proving
`healthScore`/`safety` are present and correctly shaped on real responses, that an authenticated
caller's `users_profiles` row is genuinely fetched (not a mock persona), and that disease guidance
still returns null for an anonymous caller. Full backend suite: 146 files / 1168 tests passing;
`tsc --noEmit` clean.

## Addendum — real-product live verification found and fixed a pre-existing allergen bug

Live-testing the new wiring against a real barcode (Nutella, `3017620422003`, resolved via the
real OpenFoodFacts-backed cache) surfaced a genuine, pre-existing correctness bug in
`engines/allergen/detector.ts`/`taxonomy.ts` — never caught before because the allergen engine had
never been exercised against a real product's ingredient text until this phase wired it in.
`'gluten'` is itself a declared keyword in the gluten taxonomy entry, so ingredient text containing
"Gluten free" (Nutella's actual label text) substring-matched it and produced a false,
**unsuppressible** "Contains Gluten" warning on a genuinely gluten-free product.

Flagged to the user (AskUserQuestion) before touching protected engine code, given the master
prompt's "business logic untouched" non-negotiable. User chose: fix it now, as a tracked,
separately-justified correctness fix (not a redesign change).

Fix: `findKeyword()` in `detector.ts` now strips negated occurrences (`"<keyword> free"` /
`"<keyword>-free"`) of each keyword before matching, generically for every allergen (not
gluten-specific) — a product mentioning "milk free" is likewise no longer falsely flagged for
milk. A keyword that also appears as a genuine ingredient elsewhere in the same text still
matches correctly (regression-tested). Five new golden regression tests added
(`GOLDEN-ALLERGEN-010` through `-014`) pinning the false-positive fix and the "still matches when
genuine" cases. Re-verified live post-fix: the same Nutella barcode now correctly returns only
`tree_nuts`, `milk`, `soy` (all genuinely present) with no `gluten` entry.

## Consequences
- The scanner's real production behavior changes: a scanned product now shows an actual Health
  Score and actual allergen warnings for the first time. This is a genuine feature landing, not
  cosmetic — flagged as such rather than silently bundled into "redesign."
- `label_flow.dart` / `meal_photo_flow.dart` are unaffected — they don't call `/v1/resolve/*` at
  all (OCR and meal-photo are separate pipelines) and are out of scope for this ADR.
- If a future Household/Family Guardian pass wants per-member child-safety warnings surfaced on
  the single-product screen too, `buildSafety`'s `childWarnings: []` is the one line to revisit —
  documented here rather than left as a silent gap.
