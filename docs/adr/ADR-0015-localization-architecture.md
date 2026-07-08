# ADR-0015: Localization Architecture — ARB/ICU, RTL, Numeral Systems

**Status:** Accepted  
**Date:** 2026-07-08  
**Authors:** Engineering  
**Supersedes:** None  
**Related:** ADR-0014 (CountryProfile DI)

---

## Context

Phase 2 of NutriMind Global Enterprise Edition requires supporting 22+ languages including 8 Indian
regional languages, Arabic (RTL), Urdu (RTL), and global Tier A languages (ES/FR/DE/JA/PT/ID).

Four distinct sub-problems:

1. **String localization** — ARB + Flutter gen_l10n is the established Flutter standard.
2. **RTL layout** — Arabic and Urdu users need mirrored UI. Existing India users must see zero change.
3. **Numeral rendering** — Hindi, Marathi, Bengali, Gujarati, Punjabi use native script numerals on
   nutrition labels by convention. Arabic users expect Arabic-Indic digits.
4. **Code-switching** — Indian users frequently mix English with their regional language. The app
   should support showing "प्रोटीन (Protein)" rather than forcing a hard choice.

---

## Decision

### 1. String localization: Flutter gen_l10n with ARB files

- Template: `app_en.arb` (52 keys)
- Tool: `flutter gen_l10n` via `l10n.yaml` (`generate: true` in pubspec.yaml)
- Output: `AppLocalizations` class, auto-generated
- All 15 new locales added as `app_XX.arb` files
- Missing keys fall back to English (Flutter default behaviour — not a placeholder)

**Tier classification:**
- Tier A (human-reviewed): en/hi/mr/es/fr/de/ar/ja/pt/id/ta/te/bn/gu/pa
- Tier B (MT + human review, gated by `global.p2.tier_b_languages`): kn/ml/ur/or/as
- Tier C (MT only, flagged): all others

### 2. RTL: Directionality widget at app root

RTL is applied by wrapping `MaterialApp.router` in a `Directionality` widget. This propagates
down the entire widget tree without modifying individual leaf widgets.

The `Directionality` widget is always rendered but its `textDirection` is LTR when the feature
flag `global.p2.localization_rtl` is OFF. This means existing India users see TextDirection.ltr
by default with zero visual change.

**Why Directionality at root over per-widget RTL:**
- Flutter's Material widgets (ListTile, TextField, Scaffold, etc.) inherit Directionality
  automatically. Per-widget RTL would require modifying hundreds of call sites.
- The risk of incorrect RTL in a subtree is lower when the root is authoritative.

### 3. Numeral rendering: `NumeralSystem` enum + `convertNumerals()`

A pure-Dart conversion function replaces Western Arabic digits with locale-specific glyphs.
Lives in `packages/localization_engine` and is called at display sites (nutrition label widgets).

Gated by `global.p2.numeral_rendering`. When OFF, `resolveNumeralSystem()` always returns
`NumeralSystem.western` — existing behaviour is bit-for-bit identical.

**Why not use `intl` NumberFormat directly:**
`NumberFormat` respects the system locale, not the app locale, on some platforms. Our locale is
app-controlled (driven by CountryProfile), not OS-controlled. A custom implementation is
deterministic and platform-independent.

### 4. Code-switching: `CodeSwitchingConfig` + secondary locale

When `global.p2.code_switching` is ON and the user's primary locale is non-English, a secondary
`Locale('en')` is stored. Widgets that opt in can show dual-language labels.

Gated separately so it can be rolled out independently of RTL.

### 5. LocalizationConfig as derived state

`LocalizationConfig` is a pure derivation from `CountryProfile` + `LocalizationFlags`. It is
computed synchronously in the `LocalizationEngineNotifier.build()` method and stored in Riverpod.

MaterialApp watches `activeLocaleProvider` and `activeTextDirectionProvider` (both derived from
`localizationConfigProvider`) and rebuilds on change.

---

## Alternatives Considered

### A. Global `Localizations.override` per screen instead of root Directionality
Rejected: Requires wrapping every screen individually. High maintenance overhead. Missed screens
would silently fall through to the wrong direction.

### B. intl `NumberFormat.decimalPattern(locale: ...)` for numerals
Rejected: Platform-specific locale resolution can produce unexpected results when the system locale
differs from the app locale. Custom `convertNumerals()` is deterministic.

### C. One monolithic ARB file with conditional logic
Rejected: ARB format does not support conditionals. One file per locale is the correct ARB pattern.

---

## Consequences

**Positive:**
- All existing India users see zero change (all Phase 2 flags default OFF)
- RTL propagates automatically to all Material widgets without per-widget changes
- Numeral rendering is a pure function — trivially testable, deterministic
- Adding a new locale requires only adding one ARB file and it auto-registers

**Negative:**
- 52+ ARB files to maintain long-term (mitigated: Tier B/C can use MT tooling)
- Custom numeral conversion means we maintain a digit table — low risk, tested

---

## Acceptance Gate (Phase 2)

- [ ] All 15 new ARB files load without parse errors
- [ ] RTL layout active for `ar` locale when `global.p2.localization_rtl` ON
- [ ] RTL layout LTR when flag OFF (India regression: zero)
- [ ] Numeral rendering: `hi` locale shows Devanagari digits when `global.p2.numeral_rendering` ON
- [ ] Numeral rendering: Western digits when flag OFF
- [ ] `localizationConfigProvider` rebuilds on country change
- [ ] All numeral_system and rtl_helper tests pass
- [ ] Full TypeScript suite: zero regressions
