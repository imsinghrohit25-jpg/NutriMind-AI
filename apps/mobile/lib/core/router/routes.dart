abstract final class AppRoutes {
  // Auth
  static const splash   = '/';
  static const login    = '/login';
  static const register = '/register';

  // Premium redesign (ADR-0037) — cinematic pre-auth value-prop carousel, shown once ever on a
  // device before the user reaches login (persisted flag, see core/offline/local_db.dart's
  // appIntroSeenProvider). Distinct from the mandatory onboarding/* data-collection gates below.
  static const intro = '/intro';

  // Onboarding — must complete in order before accessing app
  static const consent    = '/onboarding/consent';
  static const disclaimer = '/onboarding/disclaimer';
  // Phase 10 (`global.p10.country_onboarding_v2`)
  static const countrySetup = '/onboarding/country';
  static const languageSetup = '/onboarding/language';
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
  // Meal Planner (Phase 5 backend, apps/api/src/routes/v1/planner.ts) — fully built (generate
  // plan, view plan, generate grocery list) but was never routed here nor linked from Home; the
  // client also called a hardcoded `/api/v1/planner/...` path that never resolved to anything
  // real (fixed in meal_plan_screen.dart/grocery_list_screen.dart alongside this).
  static const mealPlan   = '/planner';

  // Premium redesign (ADR-0034) — debug-only gallery of every design-system token/component in
  // both themes. Registered in router.dart only under `kDebugMode`; never reachable from any
  // release-build navigation entry point (Phase 0 gate requirement).
  static const designSystemGallery = '/_dev/design-system';
}
