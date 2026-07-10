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
  // Phase 11 (`global.p11.ai_memory_system`)
  static const memory     = '/settings/memory';
  // Phase 13 (`global.p13.multi_agent_system`) — reachable via direct navigation, same as
  // `memory` above; not yet linked from a menu entry point (this app has no built settings/home
  // shell to link from yet — see router.dart's own comment on that pre-existing gap).
  static const agentChat  = '/assistant';
  static const voiceLog   = '/assistant/voice';
}
