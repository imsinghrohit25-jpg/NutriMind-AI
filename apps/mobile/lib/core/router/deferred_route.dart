import 'package:flutter/material.dart';

/// Wraps a Dart deferred-loaded library screen (`import '...' deferred as x;`) — shows a
/// loading indicator while `loadLibrary()` resolves, then builds the real screen once it has.
///
/// Phase 9 (`global.p9.deferred_components`): this is the real Dart-level deferred-loading
/// mechanism, verified in this environment via `flutter analyze`/`flutter test` (both catch
/// real syntax/type/runtime errors in deferred imports). It does NOT by itself verify the
/// Android-specific "Play Feature Delivery" on-demand-module-download benefit Flutter's
/// official Deferred Components feature adds on top of this — that requires Android Gradle
/// `dynamicFeatures` configuration and a release AAB build, and this environment has no Android
/// SDK installed to build/verify that with. See ADR-0023 for the full scope note.
class DeferredRoute extends StatefulWidget {
  const DeferredRoute({super.key, required this.loadLibrary, required this.builder});

  /// The deferred library's generated `loadLibrary()` function, e.g.
  /// `scanner_lib.loadLibrary` for `import '...' deferred as scanner_lib;`.
  final Future<void> Function() loadLibrary;

  /// Builds the real screen once the library has loaded — must only reference the deferred
  /// library's symbols inside this callback, never at the call site of [DeferredRoute] itself
  /// (referencing them earlier would force eager loading, defeating the deferral).
  final WidgetBuilder builder;

  @override
  State<DeferredRoute> createState() => _DeferredRouteState();
}

class _DeferredRouteState extends State<DeferredRoute> {
  late final Future<void> _future = widget.loadLibrary();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Scaffold(
            body: Center(child: Text('Failed to load feature: ${snapshot.error}')),
          );
        }
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return widget.builder(context);
      },
    );
  }
}
