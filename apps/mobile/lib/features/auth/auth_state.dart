import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/telemetry/telemetry.dart';

part 'auth_state.g.dart';

final _log = getLogger('auth.state');

class AuthUser {
  const AuthUser({required this.id, required this.email, this.role = 'authenticated'});
  final String id;
  final String email;
  final String role;
  bool get isAuthenticated => true;
}

class AuthState {
  const AuthState({this.user});
  final AuthUser? user;
  bool get isAuthenticated => user != null;
}

@riverpod
Stream<AuthState> authState(Ref ref) {
  return Supabase.instance.client.auth.onAuthStateChange.map((data) {
    final event = data.event;
    final session = data.session;
    // AuthChangeEvent.initialSession always fires first (even with no stored
    // session) — this is the event that resolves the app out of the splash
    // screen, and passwordRecovery/signedIn are the events a deep-link-driven
    // email confirmation/reset produces. Logging every event here is the
    // single choke point for verifying session restoration actually happened
    // after tapping a verification/reset email — see the deep link handler
    // inside supabase_flutter's own SupabaseAuth for the other half.
    _log.info(
      'onAuthStateChange: event=$event session=${session != null ? "present (user=${session.user.id})" : "null"}',
    );
    if (session == null) return const AuthState();
    return AuthState(
      user: AuthUser(
        id: session.user.id,
        email: session.user.email ?? '',
      ),
    );
  });
}

@riverpod
SupabaseClient supabaseClient(Ref ref) => Supabase.instance.client;
