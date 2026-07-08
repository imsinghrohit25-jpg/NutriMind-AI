# ADR-0019: OCR & Voice AI (Phase 6)

**Status:** Accepted
**Date:** 2026-07-08
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0008 (OCR strategy), ADR-0014 (CountryProfile DI), ADR-0018 (grocery/restaurant
intelligence — establishes the graceful-degradation deferral pattern this ADR reuses)

---

## Context

Phase 5 left the scanner and voice platforms India/English-first: `POST /v1/scans/label` accepted
only pre-extracted on-device OCR text with a single (FSSAI-style) pattern set, and the voice
platform (`voice/nlu.ts`, `voice/tts.ts`) had no concept of country tier at all.
`supabase/migrations/0017_feature_flags.sql` seeded four Phase 6 flags: `global.p6.cloud_ocr_
fallback`, `global.p6.label_format_router`, `global.p6.cloud_stt`, `global.p6.wake_word`. As in
Phase 5, this phase implements what real, groundable logic and reusable project patterns support
now, and explicitly defers what would require an external provider account/credentials this
environment does not have.

---

## Decision

### 1. `label_format_router` — implemented

`apps/api/src/scan/label-parser/label-formats/` follows the same registry pattern as ADR-0017's
`standards/` and ADR-0018's `grocery-providers/`: `types.ts` (`LabelFormat`/`LabelFormatId`),
one file per format (`generic.ts` — an exact port of the pre-Phase-6 `patterns.ts`, preserving
default behavior; `us_nfp.ts` — new, matches "Amount Per Serving" / "% Daily Value" US Nutrition
Facts Panel conventions), `detector.ts` (auto-detects `us_nfp` from those signals, otherwise
`generic`), and `registry.ts` (`resolveLabelFormat(text, id?)`).

`parseLabelText(rawText, formatId?)` gained an optional trailing parameter; omitting it
auto-detects and is byte-identical to pre-Phase-6 behavior for every existing FSSAI-format
fixture (asserted in `label-parser.test.ts`, unchanged, plus new `label-formats.test.ts`
coverage). `patterns.ts` was deleted — its contents moved verbatim into `generic.ts` rather than
being kept as a parallel, easily-drifting copy.

### 2. `cloud_ocr_fallback` — implemented

`script-detector.ts` classifies OCR text's dominant Unicode script (`detectScript`) and flags
which ones ML Kit Text Recognition v2 handles on-device (Latin, Devanagari, CJK, Korean) versus
which need a fallback (Arabic, Tamil, Telugu, other). `cloud-ocr-fallback.ts` implements that
fallback by reusing the existing multimodal gateway's `vision_analysis` tier — the same proven
`GatewayRouter` infrastructure `meal-photo/vision.ts` already routes through, not a new unproven
external Vision API dependency. Its output is always capped at confidence 0.6, tagged
`source: 'cloud_ocr_llm'`, and `needsUserConfirmation: true` — never auto-trusted, consistent
with this project's "LLM identifies, never becomes sole unflagged source of truth" policy (ADR-
0007, reaffirmed in ADR-0018 §3).

`POST /v1/scans/label` (previously a stub noting "server-side OCR not yet wired") now: (1) if
on-device OCR text is present and its script doesn't need cloud fallback, parses it locally
(free, deterministic, byte-identical to `/scans/ocr`); (2) otherwise calls the cloud OCR
fallback. This is purely additive to the route's existing behavior — no flag gate needed for the
route itself, matching ADR-0018 §3's reasoning for `nutritionEstimate` (new JSON keys don't
change any existing field).

### 3. `cloud_stt` — implemented (routing decision only)

`voice/stt-router.ts`'s `sttStrategyFor(tier: CountryTier)` answers a narrower, real question:
given a resolved `CountryProfile.tier`, which STT engine should the *client* use? Tier-1
countries have reliable on-device speech recognition for their primary languages already
(existing en/hi/mr voice NLU); Tier-2/fallback countries' primary languages are less reliably
covered on-device, so the client should prefer a cloud STT provider. No cloud STT SDK/credentials
are wired up here — Google Cloud Speech-to-Text, Azure Speech, etc. would each need real API keys
this environment does not have, the same deferral reasoning ADR-0018 §2 applied to
`RestaurantChainLoader`. `packages/voice_engine`'s `sttStrategyFor()` duplicates this one-line
rule client-side (not round-tripped through an API call — it depends only on `CountryTier`,
already resolved locally) and is responsible for actually invoking whichever engine it's
configured with.

### 4. `wake_word` — deferred (interface + graceful degradation only)

`voice/wake-word.ts` mirrors `RestaurantChainLoader` exactly: `wakeWordAvailability(locale)`
checks a `BUNDLED_KEYWORD_LOCALES` set and returns `{ available: false, reason: ... }` for every
locale today, since no custom "Hey NutriMind" keyword model has been trained/bundled for any
locale (that requires a Picovoice-console-style account/access key this environment does not
have). This registers the interface a real wake-word engine plugs into — and lets the client hide
wake-word UI entirely rather than show a control that silently does nothing — without fabricating
support for a locale that has no real trained model behind it.

---

## Alternatives Considered

### A. Integrate a real cloud STT/wake-word SDK now to fully implement `cloud_stt`/`wake_word`
Rejected: no provider credentials exist in this environment, and fabricating a working
integration without them would mean either mocking the call (against this project's zero-mocks
policy) or shipping code that silently fails in production. The `RestaurantChainLoader`-style
graceful-degradation interface is the correct shape to ship without the credentials/dataset.

### B. Perform cloud OCR via a dedicated external Vision API instead of the existing gateway
Rejected: the project already routes multimodal understanding (meal-photo analysis) through
`GatewayRouter` across real providers (OpenAI/Anthropic/Gemini). Reusing `vision_analysis` tier
is proven infrastructure, not a new unproven dependency, and keeps provider routing/fallback/cost
logging centralized in one place.

### C. Gate `/scans/label`'s new behavior behind `global.p6.label_format_router`/`cloud_ocr_
fallback` at the route level
Rejected: both changes are purely additive (new optional response fields, a previously-stubbed
endpoint becoming functional) with zero change to any existing caller's behavior — the same
reasoning ADR-0018 §3 used for `nutritionEstimate`. A flag gate is warranted when existing output
*changes* (ADR-0017's `computeHealthScore` country parameter), not for net-new fields.

---

## Consequences

**Positive:**
- `POST /v1/scans/label` is now functional end-to-end (previously a documented stub) with zero
  behavior change to `/scans/ocr` or the on-device-text path — all 503 existing/updated API tests
  pass.
- Label format extraction is now pluggable per country/format, following the exact registry
  pattern already proven in ADR-0017 (nutrition standards) and ADR-0018 (grocery pricing).
- `sttStrategyFor()` and `wakeWordAvailability()` give `voice_engine` a real, tested decision
  surface to build the actual client-side engine integration against, once picked.

**Negative:**
- `cloud_stt` and `wake_word` remain non-functional as actual speech features (by design) until
  provider credentials/a trained keyword model exist — no timeline is set for acquiring either.
- Cloud OCR fallback quality depends on the configured multimodal provider's vision capability
  and is capped at confidence 0.6 — it is a suggestion, never a substitute for a supported
  on-device script.
- `voice/nlu.ts`'s Hinglish-specific parsing is unaffected by this phase; Tier-2/fallback-country
  voice logging still routes through the same NLU regardless of `sttStrategyFor()`'s STT-engine
  recommendation — voice *understanding* localization for non-Indian languages remains future work.

---

## Acceptance Gate (Phase 6)

- [x] TypeScript: 0 regressions with `formatId` omitted from `parseLabelText()` (503-test suite passes)
- [x] `resolveLabelFormat(text)` auto-detects `us_nfp` from "% Daily Value"/"Amount Per Serving" and falls back to `generic` otherwise
- [x] `needsCloudOcrFallback()` is `false` for latin/devanagari/cjk/korean and `true` for arabic/tamil/telugu/other
- [x] `extractLabelViaCloudVision()` always caps `overallConfidence` ≤ 0.6 and sets `needsUserConfirmation: true` on the route response
- [x] `sttStrategyFor('tier1')` is `on_device`; `sttStrategyFor('tier2' | 'fallback')` is `cloud`
- [x] `wakeWordAvailability()` returns `available: false` with a reason for every locale (no bundled model installed)
- [x] `packages/ocr_engine`/`packages/voice_engine` Dart tests mirror and stay in sync with the TS decision logic
- [ ] Cloud STT provider credentials (blocks `cloud_stt` becoming a functional client integration — no owner/timeline yet)
- [ ] Wake-word keyword model training/licensing (blocks `wake_word` becoming functional — no owner/timeline yet)
