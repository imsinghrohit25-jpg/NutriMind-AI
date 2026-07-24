import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'core/telemetry/telemetry.dart';

// Supabase credentials injected at build time via --dart-define.
// NEVER hardcode these values here.
const _supabaseUrl     = String.fromEnvironment('SUPABASE_URL');
const _supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Verbose: authentication/deep-link/onboarding issues are the hardest class of
  // bug to reproduce on demand, so this app always ships with detailed auth
  // logging on — visible via `adb logcat` — rather than only in local dev
  // builds. Cheap in production (structured stdout lines, no PII beyond email/
  // user id already visible to the signed-in user themselves).
  setupTelemetry(verbose: true);

  final log = getLogger('bootstrap');

  assert(
    _supabaseUrl.isNotEmpty && _supabaseAnonKey.isNotEmpty,
    'SUPABASE_URL and SUPABASE_ANON_KEY must be provided via --dart-define',
  );

  log.info('Initializing Supabase (url=$_supabaseUrl)');
  await Supabase.initialize(
    url: _supabaseUrl,
    // ignore: deprecated_member_use
    anonKey: _supabaseAnonKey,
    // debug:true turns on supabase_flutter's OWN internal logger (deep-link
    // receipt, session refresh, PKCE code exchange) at fine-grained level —
    // exactly the visibility needed to verify email-confirmation deep links
    // are actually being caught, not just our own app-level logs.
    debug: true,
  );
  log.info('Supabase initialized. Existing session: ${Supabase.instance.client.auth.currentSession != null}');

  runApp(const ProviderScope(child: NutriMindApp()));
}
