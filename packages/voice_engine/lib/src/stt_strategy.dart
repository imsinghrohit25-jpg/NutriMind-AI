import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

/// Which STT engine the client should use — mirrors `SttStrategy` /
/// `sttStrategyFor()` in `apps/api/src/voice/stt-router.ts` (Phase 6, `global.p6.cloud_stt`).
/// This package does NOT perform STT itself (no cloud SDK/credentials are wired up here —
/// see ADR-0019); it only carries the routing decision so the client knows which engine to
/// invoke: on-device (`speech_to_text`) or a cloud provider it's configured with.
enum SttStrategy { onDevice, cloud }

/// Tier-1 countries (India, US, UK, ...) have reliable on-device speech recognition coverage
/// for their primary languages already; Tier-2/fallback countries' primary languages are less
/// reliably covered, so the client should prefer a cloud STT provider instead. Must stay
/// identical to the server's `sttStrategyFor()` — this one-line rule is duplicated rather than
/// round-tripped through an API call because it depends only on data (`CountryTier`) the
/// client already resolved locally via `CountryResolutionChain`.
SttStrategy sttStrategyFor(CountryTier tier) {
  return tier == CountryTier.tier1 ? SttStrategy.onDevice : SttStrategy.cloud;
}
