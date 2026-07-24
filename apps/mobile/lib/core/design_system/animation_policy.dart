import 'package:flutter/material.dart';

/// Central policy every ambient/looping design-system animation must consult before running —
/// Phase 0 (memory & battery non-negotiable #1). Rather than each widget independently checking
/// `MediaQuery.disableAnimations`/lifecycle state, they wrap themselves in [AnimationPolicyBuilder]
/// so the "should this animate right now" decision lives in exactly one place.
///
/// `shouldAnimate` is false when ANY of:
///   - the OS reduce-motion setting is on (`MediaQuery.of(context).disableAnimations`)
///   - the app is not in the foreground (`AppLifecycleState` != resumed)
/// Battery-saver has no first-class Flutter API to query directly on both platforms; this is
/// documented as a known gap (see docs/design/MOTION.md) rather than faked with an unreliable
/// platform-channel guess.
class AnimationPolicy extends ChangeNotifier with WidgetsBindingObserver {
  AnimationPolicy() {
    WidgetsBinding.instance.addObserver(this);
  }

  bool _appInForeground = true;
  bool get appInForeground => _appInForeground;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final inForeground = state == AppLifecycleState.resumed;
    if (inForeground != _appInForeground) {
      _appInForeground = inForeground;
      notifyListeners();
    }
  }

  void disposePolicy() {
    WidgetsBinding.instance.removeObserver(this);
  }
}

/// Reads [AnimationPolicy] + `MediaQuery.disableAnimations` and exposes a single `shouldAnimate`
/// bool to [builder] — ambient/looping components (float, breathing avatar, shimmer) key their
/// `AnimationController.repeat()` vs `.stop()` off this instead of re-implementing the checks.
class AnimationPolicyBuilder extends StatefulWidget {
  const AnimationPolicyBuilder({super.key, required this.builder});
  final Widget Function(BuildContext context, bool shouldAnimate) builder;

  @override
  State<AnimationPolicyBuilder> createState() => _AnimationPolicyBuilderState();
}

class _AnimationPolicyBuilderState extends State<AnimationPolicyBuilder> {
  late final AnimationPolicy _policy;

  @override
  void initState() {
    super.initState();
    _policy = AnimationPolicy()..addListener(_onChange);
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _policy.removeListener(_onChange);
    _policy.disposePolicy();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion = MediaQuery.of(context).disableAnimations;
    final shouldAnimate = _policy.appInForeground && !reducedMotion;
    return widget.builder(context, shouldAnimate);
  }
}
