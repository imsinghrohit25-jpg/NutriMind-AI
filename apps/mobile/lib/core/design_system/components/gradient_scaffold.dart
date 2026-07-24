import 'package:flutter/material.dart';

import '../tokens.dart';

/// Ambient gradient background scaffold for non-auth screens (Home, Scanner, Chat — later
/// phases). Distinct from `features/auth/widgets/auth_ui.dart`'s `AuthScaffold` (which bakes in
/// an auth-specific title/subtitle/illustration layout) — this is the generic "every premium
/// screen sits on an ambient gradient" wrapper, theme-aware (dark: deep forest-to-black; light:
/// soft mint-to-white), never a raw `Container(color: ...)` in a screen file.
class GradientScaffold extends StatelessWidget {
  const GradientScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.floatingActionButton,
    this.resizeToAvoidBottomInset,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? floatingActionButton;
  final bool? resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? const [AppColorsDark.background, Color(0xFF0E1710), AppColorsDark.background]
        : const [Color(0xFFF2F7F2), AppColors.background, Color(0xFFEDF3ED)];

    return Scaffold(
      // Extended so the gradient paints continuously behind a transparent-styled AppBar (the
      // intended cinematic look) — but that means `body` starts at y=0, so we add back exactly
      // the AppBar's own height here. The status bar itself is still handled by each screen's
      // own SafeArea around its content, same as before this widget existed.
      extendBodyBehindAppBar: appBar != null,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      appBar: appBar,
      floatingActionButton: floatingActionButton,
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: colors,
          ),
        ),
        child: Padding(
          padding: EdgeInsets.only(top: appBar?.preferredSize.height ?? 0),
          child: body,
        ),
      ),
    );
  }
}
