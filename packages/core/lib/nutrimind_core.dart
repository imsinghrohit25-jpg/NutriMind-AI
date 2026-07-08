/// NutriMind Core — shared kernel for all NutriMind packages.
///
/// Exports: Result types, NutriMindError, feature flags, logging contract.
/// This is the ONLY public import surface. Internal files are private.
library nutrimind_core;

export 'src/result.dart';
export 'src/errors.dart';
export 'src/feature_flags/feature_flags.dart';
export 'src/feature_flags/nutrimind_flags.dart';
export 'src/logging/logger.dart';
