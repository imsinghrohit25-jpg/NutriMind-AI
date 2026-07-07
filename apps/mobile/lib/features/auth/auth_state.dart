import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

part 'auth_state.g.dart';

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
  return Supabase.instance.client.auth.onAuthStateChange.map((event) {
    final session = event.session;
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
