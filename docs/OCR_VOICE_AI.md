# OCR & Voice AI — Phase 6 Reference

**Effective:** 2026-07-08 · **Phase:** 6 (Global Enterprise Edition)
**Flags:** `global.p6.label_format_router`, `global.p6.cloud_ocr_fallback`,
`global.p6.cloud_stt` (routing decision only, no provider wired), `global.p6.wake_word`
(non-functional, deferred)
**Related:** [ADR-0019](adr/ADR-0019-ocr-voice-ai.md), [ADR-0008](adr/ADR-0008-ocr-strategy.md),
[GROCERY_RESTAURANT_INTELLIGENCE.md](GROCERY_RESTAURANT_INTELLIGENCE.md) (the equivalent
reference for Phase 5, and the origin of the graceful-degradation pattern used here)

## Label format routing

| Format id | Trigger | Source basis |
|---|---|---|
| `generic` | Default / fallback | Exact port of the pre-Phase-6 pattern set (FSSAI per-100g / per-serving layout) |
| `us_nfp` | "Amount Per Serving" or "% Daily Value" detected in OCR text | US Nutrition Facts Panel layout conventions |

Adding a new country's label format requires only: a new format file in
`apps/api/src/scan/label-parser/label-formats/`, a registry entry, and a detection rule — no
`parser.ts` changes.

## Cloud OCR fallback

`detectScript()` classifies OCR text's dominant Unicode script. ML Kit Text Recognition v2
handles Latin, Devanagari, CJK, and Korean on-device; everything else (Arabic, Tamil, Telugu,
other) routes to `extractLabelViaCloudVision()`, which reuses the existing multimodal gateway's
`vision_analysis` tier — the same infrastructure `meal-photo/vision.ts` already uses. Results are
always capped at confidence 0.6 and flagged `needsUserConfirmation: true`; never auto-trusted.

`POST /v1/scans/label` chooses between the free on-device path and the cloud fallback
automatically based on the client-supplied `onDeviceOcrText`'s detected script.

## Voice STT routing — decision only, deferred integration

`sttStrategyFor(tier)` returns `on_device` for Tier-1 countries and `cloud` for Tier-2/fallback
countries. No cloud STT provider (Google Cloud Speech-to-Text, Azure Speech, etc.) is integrated
— this environment has no provider credentials. The decision is real and tested; the actual
provider call is future work once credentials exist (ADR-0019 §3).

## Wake word — deferred

`wakeWordAvailability(locale)` always returns `available: false` today: no custom "Hey
NutriMind" keyword model has been trained/bundled for any locale (requires a Picovoice-console-
style account this environment does not have). This is intentionally left non-functional rather
than claiming wake-word support that doesn't exist — mirrors `RestaurantChainLoader`'s
"no dataset installed" pattern (ADR-0018 §2).

## Known gaps (tracked, not blocking Phase 6)

- `cloud_stt` has no provider credentials, owner, or timeline.
- `wake_word` has no trained keyword model, owner, or timeline.
- Voice NLU (`voice/nlu.ts`) remains Hinglish/Hindi/English-specific — `sttStrategyFor()`'s
  routing recommendation for Tier-2/fallback countries doesn't yet change what the NLU layer
  itself can understand. Full voice *understanding* localization is future work.
