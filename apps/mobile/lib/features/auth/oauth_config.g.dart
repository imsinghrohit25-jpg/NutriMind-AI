// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'oauth_config.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$oauthProviderStatusHash() =>
    r'8af4de739c1d493d2def1f6596113696cdfa5291';

/// GoTrue's `/auth/v1/settings` endpoint is public (apikey header only, no session needed) and
/// reports which OAuth providers are actually enabled on this Supabase project. Without this,
/// a "Continue with Google" button would sit there looking functional while silently failing
/// every tap if the project's Google provider was never configured with real OAuth credentials
/// (confirmed during this app's own Gemini/Vision integration session: this project currently has
/// neither Google nor Apple enabled) — this lets the UI show an honest status instead.
/// Any failure (offline, unexpected response shape) is treated the same as "not configured":
/// never claim a provider works when it can't be confirmed.
///
/// Copied from [oauthProviderStatus].
@ProviderFor(oauthProviderStatus)
final oauthProviderStatusProvider =
    AutoDisposeFutureProvider<OAuthProviderStatus>.internal(
  oauthProviderStatus,
  name: r'oauthProviderStatusProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$oauthProviderStatusHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef OauthProviderStatusRef
    = AutoDisposeFutureProviderRef<OAuthProviderStatus>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
