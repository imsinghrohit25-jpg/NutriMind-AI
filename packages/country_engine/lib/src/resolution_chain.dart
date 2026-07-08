// Country resolution chain — Phase 1 will implement full 6-step resolution.
// Skeleton only.

import 'country_profile.dart';
import 'country_registry.dart';

/// Resolves CountryProfile for the current session.
///
/// Resolution order (Phase 1 will implement all steps):
///  1. User explicit override (stored in user profile)
///  2. Profile setting (persisted from onboarding)
///  3. SIM MCC (telephony)
///  4. OS locale region
///  5. IP geolocation (edge header X-Country)
///  6. GLOBAL fallback
class CountryResolutionChain {
  const CountryResolutionChain();

  /// Resolves the best CountryProfile for the session.
  /// In Phase 0 skeleton: resolves from [explicitOverride] or falls back to GLOBAL.
  CountryProfile resolve({
    String? explicitOverride,
    String? profileCountry,
    String? simMcc,
    String? osLocaleRegion,
    String? ipCountryHeader,
  }) {
    for (final candidate in [
      explicitOverride,
      profileCountry,
      // SIM MCC → ISO code translation is Phase 1
      // osLocaleRegion needs region extraction (Phase 1)
      ipCountryHeader,
    ]) {
      if (candidate != null && candidate.isNotEmpty) {
        final profile = CountryRegistry.lookup(candidate);
        if (profile != null) return profile;
      }
    }
    return CountryProfile.global;
  }
}
