// Wake-word activation support — Phase 6 (`global.p6.wake_word`).
// Mirrors RestaurantChainLoader's graceful-degradation shape (ADR-0018 §2): this defines the
// interface a real on-device wake-word engine plugs into, without fabricating support for a
// locale that doesn't have a real trained keyword model behind it. A "Hey NutriMind"-style
// on-device wake word needs a custom keyword model (e.g. via the Picovoice Porcupine console)
// exported per supported language — none have been trained/bundled in this environment (that
// requires a Picovoice account/access key this environment does not have). See ADR-0019 for
// the same deferral reasoning applied to `sttStrategyFor` and, before it, `RestaurantChainLoader`.

import type { SupportedLocale } from '../i18n/language.js';

export interface WakeWordAvailability {
  available: boolean;
  reason?: string;
}

// No custom keyword model has been trained/bundled for any locale yet — deliberately empty
// until a real model exists. Adding a locale here is the only change needed once one does.
const BUNDLED_KEYWORD_LOCALES: ReadonlySet<SupportedLocale> = new Set([]);

/** Whether on-device wake-word activation is available for `locale`. Never fabricates support. */
export function wakeWordAvailability(locale: SupportedLocale): WakeWordAvailability {
  if (BUNDLED_KEYWORD_LOCALES.has(locale)) {
    return { available: true };
  }
  return { available: false, reason: 'no bundled keyword model for this locale' };
}
