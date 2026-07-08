// Feature flag service.
// Fetches resolved flags from /api/v1/flags at app startup.
// Falls back to local defaults (all global.* flags = false).
// Cached in SharedPreferences for offline resilience.

import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Resolved feature flag snapshot for this session.
/// Immutable after resolution.
@immutable
class FlagSnapshot {
  const FlagSnapshot(this._flags);

  factory FlagSnapshot.defaults() => const FlagSnapshot({});

  /// Create a snapshot with ALL flags enabled (for testing).
  factory FlagSnapshot.allEnabled() {
    return FlagSnapshot({
      for (final key in NutriMindFlagKeys.all) key: true,
    });
  }

  final Map<String, bool> _flags;

  bool isEnabled(String key) => _flags[key] ?? false;

  Map<String, bool> toMap() => Map.unmodifiable(_flags);

  @override
  bool operator ==(Object other) =>
      other is FlagSnapshot && mapEquals(_flags, other._flags);

  @override
  int get hashCode => _flags.hashCode;
}

/// Service that fetches and caches feature flags.
class FeatureFlagService {
  FeatureFlagService({
    required Dio dio,
    required SharedPreferences prefs,
  })  : _dio = dio,
        _prefs = prefs;

  final Dio _dio;
  final SharedPreferences _prefs;
  static const _cacheKey = 'nutrimind.feature_flags';

  FlagSnapshot _current = FlagSnapshot.defaults();
  FlagSnapshot get current => _current;

  /// Fetch flags from API; fall back to cached/defaults on error.
  Future<void> refresh() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/v1/flags',
        options: Options(receiveTimeout: const Duration(seconds: 5)),
      );
      final data = response.data?['flags'] as Map<String, dynamic>? ?? {};
      final resolved = data.map((k, v) => MapEntry(k, v as bool));
      _current = FlagSnapshot(resolved);
      await _prefs.setString(_cacheKey, jsonEncode(resolved));
    } catch (_) {
      // Network error: try cache
      final cached = _prefs.getString(_cacheKey);
      if (cached != null) {
        final decoded = jsonDecode(cached) as Map<String, dynamic>;
        _current = FlagSnapshot(decoded.map((k, v) => MapEntry(k, v as bool)));
      }
      // else stay at defaults
    }
  }
}

/// Flag key constants — import NutriMindFlagKeys from nutrimind_flags.dart.
export 'nutrimind_flags.dart';
