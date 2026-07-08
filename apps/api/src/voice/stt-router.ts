// STT routing strategy — Phase 6 (`global.p6.cloud_stt`).
// NutriMind does not perform STT server-side (mirrors tts.ts: TTS synthesis also happens
// client-side). This module answers a narrower, real question: given a user's CountryProfile
// tier, *which* STT engine should the client use? Tier-1 countries (India, US, UK, ...) have
// good on-device speech recognition coverage for their primary languages already (existing
// en/hi/mr voice NLU). Tier-2 countries' primary languages are less reliably covered by
// on-device engines, so the client should prefer a cloud STT provider instead.
//
// This is a routing *decision*, not a provider integration: no cloud STT SDK/credentials are
// wired up here (Google Cloud Speech-to-Text, Azure Speech, etc. would each need real API
// keys this environment does not have — see ADR-0019 for the same deferral reasoning applied
// to RestaurantChainLoader in ADR-0018). The Dart voice_engine package consumes this decision
// and is responsible for actually calling whichever cloud provider it's configured with.

import type { CountryTier } from '../country/types.js';

export type SttStrategy = 'on_device' | 'cloud';

export function sttStrategyFor(tier: CountryTier): SttStrategy {
  return tier === 'tier1' ? 'on_device' : 'cloud';
}
