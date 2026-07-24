import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'oauth_config.g.dart';

// Same build-time constants as main.dart (dart-define is a compile-time constant; redeclaring
// it here is the standard way to read it from a second file — there's no runtime cost or
// duplication of the actual value).
const _supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const _supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

class OAuthProviderStatus {
  const OAuthProviderStatus({required this.googleEnabled, required this.appleEnabled});
  final bool googleEnabled;
  final bool appleEnabled;
}

/// GoTrue's `/auth/v1/settings` endpoint is public (apikey header only, no session needed) and
/// reports which OAuth providers are actually enabled on this Supabase project. Without this,
/// a "Continue with Google" button would sit there looking functional while silently failing
/// every tap if the project's Google provider was never configured with real OAuth credentials
/// (confirmed during this app's own Gemini/Vision integration session: this project currently has
/// neither Google nor Apple enabled) — this lets the UI show an honest status instead.
/// Any failure (offline, unexpected response shape) is treated the same as "not configured":
/// never claim a provider works when it can't be confirmed.
@riverpod
Future<OAuthProviderStatus> oauthProviderStatus(Ref ref) async {
  try {
    final dio = Dio();
    final response = await dio.get<Map<String, dynamic>>(
      '$_supabaseUrl/auth/v1/settings',
      options: Options(headers: {'apikey': _supabaseAnonKey}),
    );
    final external = response.data?['external'] as Map<String, dynamic>?;
    return OAuthProviderStatus(
      googleEnabled: external?['google'] == true,
      appleEnabled: external?['apple'] == true,
    );
  } catch (_) {
    return const OAuthProviderStatus(googleEnabled: false, appleEnabled: false);
  }
}
