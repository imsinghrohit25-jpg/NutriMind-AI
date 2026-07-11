import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../offline/local_db.dart';
import '../../features/auth/auth_state.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/onboarding/screens/consent_screen.dart';
import '../../features/onboarding/screens/disclaimer_screen.dart';
import '../../features/onboarding/screens/country_selection_screen.dart';
import '../../features/profile/screens/profile_setup_screen.dart';
import '../../features/household/screens/household_screen.dart';
import '../../features/scanner/screens/scanner_screen.dart' deferred as scanner_lib;
import '../../features/home/home_screen.dart';
import '../../features/memory/screens/memory_screen.dart';
import '../../features/agent/agent_chat_screen.dart';
import '../../features/voice/voice_log_screen.dart';
import 'deferred_route.dart';
import 'routes.dart';

part 'router.g.dart';

@riverpod
GoRouter router(Ref ref) {
  final authState = ref.watch(authStateProvider);
  final onboardingState = ref.watch(onboardingStateProvider);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final isAuthenticated = authState.valueOrNull?.isAuthenticated ?? false;
      final hasConsent      = onboardingState.valueOrNull?.hasConsent ?? false;
      final hasDisclaimer   = onboardingState.valueOrNull?.hasDisclaimer ?? false;
      final hasCountry      = onboardingState.valueOrNull?.hasCountry ?? false;
      final hasProfile      = onboardingState.valueOrNull?.hasProfile ?? false;

      final path = state.matchedLocation;

      // Auth guard
      if (!isAuthenticated) {
        if (path == AppRoutes.login) return null;
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
      } else if (!hasProfile) {
        requiredOnboardingPath = AppRoutes.profileSetup;
      }
      if (requiredOnboardingPath != null && path != requiredOnboardingPath) {
        return requiredOnboardingPath;
      }

      // Redirect away from auth/onboarding screens once complete — only once every gate above is
      // actually satisfied (requiredOnboardingPath null). Without this guard, a user legitimately
      // parked on their current required onboarding step (path == requiredOnboardingPath, so the
      // block above didn't redirect) would still match one of the paths below and get bounced to
      // home before finishing onboarding — the same class of bug as the loop above, just latent
      // until that one was fixed.
      if (requiredOnboardingPath == null &&
          (path == AppRoutes.login || path == AppRoutes.splash ||
              path == AppRoutes.consent || path == AppRoutes.disclaimer ||
              path == AppRoutes.countrySetup || path == AppRoutes.profileSetup)) {
        return AppRoutes.home;
      }

      return null;
    },
    routes: [
      GoRoute(path: AppRoutes.splash,  builder: (_, __) => const _SplashScreen()),
      GoRoute(path: AppRoutes.login,   builder: (_, __) => const LoginScreen()),
      GoRoute(path: AppRoutes.consent, builder: (_, __) => const ConsentScreen()),
      GoRoute(path: AppRoutes.disclaimer, builder: (_, __) => const DisclaimerScreen()),
      GoRoute(path: AppRoutes.countrySetup, builder: (_, __) => const CountrySelectionScreen()),
      GoRoute(path: AppRoutes.profileSetup, builder: (_, __) => const ProfileSetupScreen()),
      GoRoute(path: AppRoutes.home,    builder: (_, __) => const HomeScreen()),
      // Deferred (Phase 9, `global.p9.deferred_components`) — the scanner screen pulls in the
      // `camera` plugin, not needed until the user actually navigates here. See DeferredRoute.
      GoRoute(
        path: AppRoutes.scanner,
        builder: (_, __) => DeferredRoute(
          loadLibrary: scanner_lib.loadLibrary,
          builder: (_) => scanner_lib.ScannerScreen(),
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
    ],
  );
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
