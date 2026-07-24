import 'dart:async';

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../offline/local_db.dart';
import '../telemetry/telemetry.dart';
import '../../features/auth/auth_state.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';
import '../../features/onboarding/screens/app_intro_screen.dart';
import '../../features/onboarding/screens/consent_screen.dart';
import '../../features/onboarding/screens/disclaimer_screen.dart';
import '../../features/onboarding/screens/country_selection_screen.dart';
import '../../features/onboarding/screens/language_selection_screen.dart';
import '../../features/profile/screens/profile_setup_screen.dart';
import '../../features/household/screens/household_screen.dart';
import '../../features/scanner/screens/scanner_screen.dart' deferred as scanner_lib;
import '../../features/home/home_screen.dart';
import '../../features/memory/screens/memory_screen.dart';
import '../../features/agent/agent_chat_screen.dart';
import '../../features/voice/voice_log_screen.dart';
import '../../features/planner/meal_plan_screen.dart';
import '../design_system/gallery/design_system_gallery_screen.dart';
import 'deferred_route.dart';
import 'routes.dart';

part 'router.g.dart';

final _log = getLogger('router');

@riverpod
GoRouter router(Ref ref) {
  final authState = ref.watch(authStateProvider);
  final onboardingState = ref.watch(onboardingStateProvider);
  final introSeenState = ref.watch(appIntroSeenProvider);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final isAuthenticated = authState.valueOrNull?.isAuthenticated ?? false;
      final hasSeenIntro    = introSeenState.valueOrNull ?? false;
      final hasConsent      = onboardingState.valueOrNull?.hasConsent ?? false;
      final hasDisclaimer   = onboardingState.valueOrNull?.hasDisclaimer ?? false;
      final hasCountry      = onboardingState.valueOrNull?.hasCountry ?? false;
      final hasLanguage     = onboardingState.valueOrNull?.hasLanguage ?? false;
      final hasProfile      = onboardingState.valueOrNull?.hasProfile ?? false;

      final path = state.matchedLocation;

      // Debug-only design-system gallery (Phase 0 of the premium redesign) — reachable without
      // auth/onboarding gates so it's usable for pure visual QA; only registered below under
      // kDebugMode in the first place, so this branch is unreachable in release builds anyway.
      if (path == AppRoutes.designSystemGallery) return null;

      _log.fine(
        'redirect eval: path=$path authLoading=${authState.isLoading} onboardingLoading=${onboardingState.isLoading} '
        'authenticated=$isAuthenticated introSeen=$hasSeenIntro consent=$hasConsent disclaimer=$hasDisclaimer '
        'country=$hasCountry language=$hasLanguage profile=$hasProfile',
      );

      // Cinematic pre-auth intro carousel (ADR-0037, Phase 1) — checked before the auth guard
      // since it's shown to signed-out first-time users. Login/register are deliberately exempt
      // even when unseen, so a shared deep link into either never gets trapped behind the carousel.
      if (!isAuthenticated && !hasSeenIntro) {
        if (path == AppRoutes.intro || path == AppRoutes.login || path == AppRoutes.register) return null;
        _log.info('redirect: $path -> ${AppRoutes.intro} (intro not yet seen)');
        return AppRoutes.intro;
      }

      // Auth guard — register lives alongside login as the two screens reachable while signed out.
      if (!isAuthenticated) {
        if (path == AppRoutes.login || path == AppRoutes.register) return null;
        _log.info('redirect: $path -> ${AppRoutes.login} (not authenticated)');
        return AppRoutes.login;
      }

      // Onboarding gates — must complete in order. Computed as a single target (the first unmet
      // gate, from state alone) before ever comparing against the current path — four independent
      // `if (!hasX && path != x) return x` checks in sequence caused a real redirect loop: sitting
      // on the consent screen with hasDisclaimer also still false satisfied the second check's
      // `path != disclaimer` on the very same pass and redirected straight to disclaimer, which
      // then bounced back to consent, forever. Hits every brand-new user (nothing onboarded yet
      // means every hasX is false at once) — found by actually signing in as one.
      String? requiredOnboardingPath;
      if (!hasConsent) {
        requiredOnboardingPath = AppRoutes.consent;
      } else if (!hasDisclaimer) {
        requiredOnboardingPath = AppRoutes.disclaimer;
      } else if (!hasCountry) {
        // Phase 10 (`global.p10.country_onboarding_v2`)
        requiredOnboardingPath = AppRoutes.countrySetup;
      } else if (!hasLanguage) {
        requiredOnboardingPath = AppRoutes.languageSetup;
      } else if (!hasProfile) {
        requiredOnboardingPath = AppRoutes.profileSetup;
      }
      if (requiredOnboardingPath != null && path != requiredOnboardingPath) {
        _log.info('redirect: $path -> $requiredOnboardingPath (onboarding gate)');
        return requiredOnboardingPath;
      }

      // Redirect away from auth/onboarding screens once complete — only once every gate above is
      // actually satisfied (requiredOnboardingPath null). Without this guard, a user legitimately
      // parked on their current required onboarding step (path == requiredOnboardingPath, so the
      // block above didn't redirect) would still match one of the paths below and get bounced to
      // home before finishing onboarding — the same class of bug as the loop above, just latent
      // until that one was fixed.
      if (requiredOnboardingPath == null &&
          (path == AppRoutes.intro || path == AppRoutes.login || path == AppRoutes.register || path == AppRoutes.splash ||
              path == AppRoutes.consent || path == AppRoutes.disclaimer ||
              path == AppRoutes.countrySetup || path == AppRoutes.languageSetup ||
              path == AppRoutes.profileSetup)) {
        _log.info('redirect: $path -> ${AppRoutes.home} (onboarding complete)');
        return AppRoutes.home;
      }

      return null;
    },
    routes: [
      GoRoute(path: AppRoutes.splash,  builder: (_, __) => const _SplashScreen()),
      GoRoute(path: AppRoutes.intro,   builder: (_, __) => const AppIntroScreen()),
      GoRoute(path: AppRoutes.login,   builder: (_, __) => const LoginScreen()),
      GoRoute(path: AppRoutes.register, builder: (_, __) => const RegisterScreen()),
      GoRoute(path: AppRoutes.consent, builder: (_, __) => const ConsentScreen()),
      GoRoute(path: AppRoutes.disclaimer, builder: (_, __) => const DisclaimerScreen()),
      GoRoute(path: AppRoutes.countrySetup, builder: (_, __) => const CountrySelectionScreen()),
      GoRoute(path: AppRoutes.languageSetup, builder: (_, __) => const LanguageSelectionScreen()),
      GoRoute(path: AppRoutes.profileSetup, builder: (_, __) => const ProfileSetupScreen()),
      GoRoute(path: AppRoutes.home,    builder: (_, __) => const HomeScreen()),
      // Deferred (Phase 9, `global.p9.deferred_components`) — the scanner screen pulls in the
      // `camera` plugin, not needed until the user actually navigates here. See DeferredRoute.
      // `?mode=label` selects the nutrition-label capture UI instead of barcode (see Home's
      // "Scan nutrition label" card) — both previously routed to the same barcode-only screen.
      GoRoute(
        path: AppRoutes.scanner,
        builder: (_, state) => DeferredRoute(
          loadLibrary: scanner_lib.loadLibrary,
          builder: (_) => scanner_lib.ScannerScreen(
            mode: switch (state.uri.queryParameters['mode']) {
              'label' => scanner_lib.ScanMode.label,
              'meal' => scanner_lib.ScanMode.meal,
              _ => scanner_lib.ScanMode.barcode,
            },
          ),
        ),
      ),
      GoRoute(path: AppRoutes.household, builder: (_, __) => const HouseholdScreen()),
      GoRoute(path: AppRoutes.profile, builder: (_, __) => const ProfileSetupScreen()),
      // Phase 11 (`global.p11.ai_memory_system`) — reachable via direct navigation; not yet
      // linked from a settings/profile entry point (this app has no built settings shell yet —
      // same gap as DataRightsScreen, ApiClient's lack of a DI seam, and most of
      // features/ — tracked, not fabricated as solved here).
      GoRoute(path: AppRoutes.memory, builder: (_, __) => const MemoryScreen()),
      // Phase 13 (`global.p13.multi_agent_system`) — same "routed, not yet menu-linked" gap as
      // MemoryScreen above.
      GoRoute(path: AppRoutes.agentChat, builder: (_, __) => const AgentChatScreen()),
      GoRoute(path: AppRoutes.voiceLog, builder: (_, __) => const VoiceLogScreen()),
      GoRoute(path: AppRoutes.mealPlan, builder: (_, __) => const MealPlanScreen()),
      // Premium redesign (ADR-0034) — debug-only, never present in a release build.
      if (kDebugMode)
        GoRoute(path: AppRoutes.designSystemGallery, builder: (_, __) => const DesignSystemGalleryScreen()),
    ],
  );
}

// Not just a spinner: `authStateProvider` always emits an initial event fast (supabase_flutter
// guarantees an `AuthChangeEvent.initialSession` at startup even with no stored session), so this
// screen should resolve near-instantly in practice. But "eliminate every infinite spinner" means
// this one gets a bounded escape hatch too — if the router hasn't moved on within 8 seconds
// (auth stream genuinely stuck, not just slow), surface a definite state with a manual retry
// instead of leaving the user staring at a spinner forever with no explanation.
class _SplashScreen extends StatefulWidget {
  const _SplashScreen();

  @override
  State<_SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<_SplashScreen> {
  bool _timedOut = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(seconds: 8), () { // design-governance:ignore: redirect safety timeout, not an animation
      if (!mounted) return;
      _log.warning('Splash screen still showing after 8s — auth state stream has not resolved');
      setState(() => _timedOut = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: _timedOut
            ? Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.wifi_off, size: 40),
                    const SizedBox(height: 16),
                    const Text(
                      'Taking longer than expected to start up.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () {
                        setState(() => _timedOut = false);
                        _timer = Timer(const Duration(seconds: 8), () { // design-governance:ignore: redirect safety timeout, not an animation
                          if (mounted) setState(() => _timedOut = true);
                        });
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              )
            : const CircularProgressIndicator(),
      ),
    );
  }
}
