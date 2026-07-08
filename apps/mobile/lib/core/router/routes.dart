abstract final class AppRoutes {
  // Auth
  static const splash   = '/';
  static const login    = '/login';

  // Onboarding — must complete in order before accessing app
  static const consent    = '/onboarding/consent';
  static const disclaimer = '/onboarding/disclaimer';
  // Phase 10 (`global.p10.country_onboarding_v2`)
  static const countrySetup = '/onboarding/country';
  static const profileSetup = '/onboarding/profile';
  static const householdSetup = '/onboarding/household';

  // Main app (requires auth + consent + disclaimer)
  static const home      = '/home';
  static const scanner   = '/scanner';
  static const household = '/household';
  static const profile   = '/profile';
}
