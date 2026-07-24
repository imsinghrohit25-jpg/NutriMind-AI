import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/design_system/components/nutrimind_logo.dart';
import '../../../core/design_system/haptic_service.dart';
import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/offline/local_db.dart';
import '../../../core/router/routes.dart';

/// Cinematic pre-auth value-prop carousel (ADR-0037, Phase 1). Shown once ever on a device
/// before the user reaches login — router.dart redirects here for a fresh install and never
/// again once `appIntroSeenProvider` is true. Zero auth/session logic: this screen only ever
/// sets a local flag and navigates to /login.
class AppIntroScreen extends ConsumerStatefulWidget {
  const AppIntroScreen({super.key});

  @override
  ConsumerState<AppIntroScreen> createState() => _AppIntroScreenState();
}

class _IntroSlide {
  const _IntroSlide({required this.icon, required this.title, required this.body, required this.colors});
  final IconData icon;
  final String title;
  final String body;
  final List<Color> colors;
}

const _slides = <_IntroSlide>[
  _IntroSlide(
    icon: Icons.eco_rounded,
    title: 'NutriMind',
    body: 'Your AI-powered personal nutrition companion — built on real global food science.',
    colors: [AppColors.primaryDark, AppColors.primary, AppColors.primaryLight],
  ),
  _IntroSlide(
    icon: Icons.qr_code_scanner_rounded,
    title: 'Scan Any Product, Instantly',
    body: 'Point your camera at a barcode or nutrition label — NutriMind resolves it against '
        'IFCT, USDA, and global food databases in seconds.',
    colors: [Color(0xFF0D4422), Color(0xFF1B6B3A), Color(0xFF4C9E6B)],
  ),
  _IntroSlide(
    icon: Icons.psychology_rounded,
    title: 'AI That Understands You',
    body: 'A personalized nutrition assistant that factors in your goals, conditions, and '
        'preferences — every answer grounded in real, computed data.',
    colors: [Color(0xFF1B3A6B), Color(0xFF2E5A9E), Color(0xFF5B8FD1)],
  ),
  _IntroSlide(
    icon: Icons.family_restroom_rounded,
    title: "Your Family's Health, Together",
    body: 'Track allergens and preferences for everyone in your household — with a hard safety '
        'gate that never lets a known allergen slip through.',
    colors: [Color(0xFF6B3A1B), Color(0xFF9E5A2E), Color(0xFFD18F5B)],
  ),
];

class _AppIntroScreenState extends ConsumerState<AppIntroScreen> {
  final _pageController = PageController();
  double _page = 0;

  @override
  void initState() {
    super.initState();
    _pageController.addListener(() {
      setState(() => _page = _pageController.page ?? 0);
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    final db = ref.read(localDbProvider);
    await db.setFlag('app_intro_v1', 'true');
    if (mounted) context.go(AppRoutes.login);
  }

  void _onPageChanged(int page) {
    HapticService.selection(context: context);
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _page.round() == _slides.length - 1;

    return Scaffold(
      body: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: _slides.length,
            onPageChanged: _onPageChanged,
            itemBuilder: (context, index) {
              final slide = _slides[index];
              // Parallax: background moves at 0.4x the foreground swipe speed, computed from the
              // live page fraction — no separate gesture detector needed.
              final delta = (index - _page).clamp(-1.0, 1.0);
              return DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: slide.colors,
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxl),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Transform.translate(
                          offset: Offset(delta * 60, 0),
                          child: index == 0
                              ? const NutriMindLogo(size: 140, state: NutriMindMoodState.idle)
                                  .animate()
                                  .fadeIn(duration: AppMotion.cinematic)
                                  .scale(begin: const Offset(0.8, 0.8), end: const Offset(1, 1), duration: AppMotion.cinematic, curve: AppMotion.emphasized)
                              : _SlideGlyph(icon: slide.icon),
                        ),
                        const SizedBox(height: AppSpacing.xxl),
                        Text(
                          slide.title,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.displaySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
                        )
                            .animate(delay: AppMotion.staggerStep)
                            .fadeIn(duration: AppMotion.standard)
                            .slideY(begin: 0.15, end: 0, duration: AppMotion.standard, curve: AppMotion.enter),
                        const SizedBox(height: AppSpacing.m),
                        Text(
                          slide.body,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Colors.white.withValues(alpha: 0.88)),
                        )
                            .animate(delay: AppMotion.staggerStep * 2)
                            .fadeIn(duration: AppMotion.standard)
                            .slideY(begin: 0.15, end: 0, duration: AppMotion.standard, curve: AppMotion.enter),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),

          // Skip — always reachable except visually replaced by "Get Started" on the last slide.
          Positioned(
            top: 0, right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.l),
                child: AnimatedOpacity(
                  opacity: isLast ? 0 : 1,
                  duration: AppMotion.micro,
                  child: IgnorePointer(
                    ignoring: isLast,
                    child: TextButton(
                      onPressed: _finish,
                      style: TextButton.styleFrom(foregroundColor: Colors.white.withValues(alpha: 0.85)),
                      child: const Text('Skip'),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Page indicator + primary CTA.
          Positioned(
            left: 0, right: 0, bottom: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(_slides.length, (i) {
                        final active = i == _page.round();
                        return AnimatedContainer(
                          duration: AppMotion.micro,
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: active ? 24 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: active ? 0.95 : 0.4),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    AnimatedSwitcher(
                      duration: AppMotion.standard,
                      child: isLast
                          ? SizedBox(
                              key: const ValueKey('cta'),
                              width: double.infinity,
                              child: FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: context.colors.primaryDark,
                                  minimumSize: const Size(double.infinity, 54),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                                ),
                                onPressed: _finish,
                                child: const Text('Get Started', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                              ),
                            )
                          : SizedBox(
                              key: const ValueKey('next'),
                              width: double.infinity,
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.white,
                                  side: BorderSide(color: Colors.white.withValues(alpha: 0.6)),
                                  minimumSize: const Size(double.infinity, 54),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                                ),
                                onPressed: () => _pageController.nextPage(
                                  duration: AppMotion.standard,
                                  curve: AppMotion.enter,
                                ),
                                child: const Text('Next', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SlideGlyph extends StatelessWidget {
  const _SlideGlyph({required this.icon});
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 140,
      height: 140,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white.withValues(alpha: 0.28), Colors.white.withValues(alpha: 0.08)],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.5),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 64, color: Colors.white),
    )
        .animate()
        .fadeIn(duration: AppMotion.cinematic)
        .scale(begin: const Offset(0.85, 0.85), end: const Offset(1, 1), duration: AppMotion.cinematic, curve: AppMotion.emphasized);
  }
}
