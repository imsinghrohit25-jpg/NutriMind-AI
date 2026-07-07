import 'package:logging/logging.dart';

void setupTelemetry({bool verbose = false}) {
  Logger.root.level = verbose ? Level.ALL : Level.INFO;
  Logger.root.onRecord.listen((record) {
    // In production, route to Sentry / Crashlytics in a later phase.
    // For now, write structured output to stdout.
    final ts = record.time.toIso8601String();
    final level = record.level.name.padRight(7);
    final name  = record.loggerName;
    final msg   = record.message;
    // ignore: avoid_print
    print('[$ts] $level $name: $msg');
    if (record.error != null) {
      // ignore: avoid_print
      print('  error: ${record.error}');
    }
    if (record.stackTrace != null && verbose) {
      // ignore: avoid_print
      print('  stack: ${record.stackTrace}');
    }
  });
}

Logger getLogger(String name) => Logger(name);
