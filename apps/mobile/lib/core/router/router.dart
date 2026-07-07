import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../offline/local_db.dart';
import '../../features/auth/auth_state.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/onboarding/screens/consent_screen.dart';
import '../../features/onboarding/screens/disclaimer_screen.dart';
import '../../features/profile/screens/profile_setup_screen.dart';
import '../../features/household/screens/household_screen.dart';
import '../../features/scanner/screens/scanner_screen.dart';
import '../../features/home/home_screen.dart';
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
      final hasProfile      = onboardingState.valueOrNull?.hasProfile ?? false;

      final path = state.matchedLocation;

      // Auth guard
      if (!isAuthenticated) {
        if (path == AppRoutes.login) return null;
        return AppRoutes.login;
      }

      // Onboarding gates — must complete in order
      if (!hasConsent && path != AppRoutes.consent) return AppRoutes.consent;
      if (!hasDisclaimer && path != AppRoutes.disclaimer) return AppRoutes.disclaimer;
      if (!hasProfile && path != AppRoutes.profileSetup) return AppRoutes.profileSetup;

      // Redirect away from auth/onboarding screens once complete
      if (path == AppRoutes.login || path == AppRoutes.splash ||
          path == AppRoutes.consent || path == AppRoutes.disclaimer ||
          path == AppRoutes.profileSetup) {
        return AppRoutes.home;
      }

      return null;
    },
    routes: [
      GoRoute(path: AppRoutes.splash,  builder: (_, __) => const _SplashScreen()),
      GoRoute(path: AppRoutes.login,   builder: (_, __) => const LoginScreen()),
      GoRoute(path: AppRoutes.consent, builder: (_, __) => const ConsentScreen()),
      GoRoute(path: AppRoutes.disclaimer, builder: (_, __) => const DisclaimerScreen()),
      GoRoute(path: AppRoutes.profileSetup, builder: (_, __) => const ProfileSetupScreen()),
      GoRoute(path: AppRoutes.home,    builder: (_, __) => const HomeScreen()),
      GoRoute(path: AppRoutes.scanner, builder: (_, __) => const ScannerScreen()),
      GoRoute(path: AppRoutes.household, builder: (_, __) => const HouseholdScreen()),
      GoRoute(path: AppRoutes.profile, builder: (_, __) => const ProfileSetupScreen()),
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
