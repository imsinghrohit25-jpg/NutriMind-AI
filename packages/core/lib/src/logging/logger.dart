// Structured logging contract used across all packages.

import 'package:logging/logging.dart' show Logger, Level;

export 'package:logging/logging.dart' show Logger, Level;

/// Convenience: get a named logger for a module.
Logger nutriLogger(String name) => Logger('nutrimind.$name');
