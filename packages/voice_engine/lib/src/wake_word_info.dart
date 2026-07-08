/// Wake-word activation availability — mirrors `WakeWordAvailability` /
/// `wakeWordAvailability()` in `apps/api/src/voice/wake-word.ts` (Phase 6,
/// `global.p6.wake_word`). No on-device wake-word engine is wired up here: a real "Hey
/// NutriMind" keyword model needs to be trained/bundled per locale first (see ADR-0019 — the
/// same deferral reasoning as `RestaurantChainLoader`, ADR-0018 §2). This mirrors the server's
/// empty bundled-locale list so the client can hide wake-word UI entirely rather than showing
/// a control that silently does nothing.
class WakeWordAvailability {
  const WakeWordAvailability({required this.available, this.reason});

  final bool available;
  final String? reason;
}

/// No custom keyword model has been trained/bundled for any locale yet — must stay identical
/// to the server's `BUNDLED_KEYWORD_LOCALES` set in `wake-word.ts`.
const _bundledKeywordLocales = <String>{};

/// Whether on-device wake-word activation is available for [localeCode] (e.g. `'en'`, `'hi'`).
/// Never fabricates support for a locale with no real bundled model.
WakeWordAvailability wakeWordAvailabilityFor(String localeCode) {
  if (_bundledKeywordLocales.contains(localeCode)) {
    return const WakeWordAvailability(available: true);
  }
  return const WakeWordAvailability(
    available: false,
    reason: 'no bundled keyword model for this locale',
  );
}
