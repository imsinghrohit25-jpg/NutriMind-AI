import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';

/// The signed-in user's condition-aware nutrition guidance, from the existing (already-registered)
/// `GET /v1/disease/guidance` route — the same deterministic engine output that
/// [DiseaseChipsWidget] renders per-product on the Product screen, here fetched once for the Home
/// summary card. Reuses the shared [apiClientProvider] (JWT attached by its interceptor); no new
/// endpoint or engine. Empty `conditions` = the user set no health conditions in their profile, so
/// the Home card simply hides itself (honest empty state, never a fabricated placeholder).
class DiseaseGuidance {
  const DiseaseGuidance({required this.conditions, required this.blocks});

  /// Condition ids from `users_profiles.conditions` that mapped to a guidance block.
  final List<String> conditions;

  /// One `ConditionGuidance` per condition: { condition, label, safeFoods[], avoidFoods[],
  /// recommendations[], warnings[], citationIds[] } — the engine's own shape, rendered as-is.
  final List<Map<String, dynamic>> blocks;

  bool get isEmpty => blocks.isEmpty;

  /// Parses the `GET /v1/disease/guidance` response body. Routes wrap payloads as
  /// `{ ok, data, meta }`; an already-unwrapped body is tolerated for robustness.
  factory DiseaseGuidance.fromBody(Map<String, dynamic> body) {
    final data = body['data'] is Map<String, dynamic> ? body['data'] as Map<String, dynamic> : body;
    return DiseaseGuidance(
      conditions: (data['conditions'] as List?)?.whereType<String>().toList() ?? const <String>[],
      blocks: (data['guidance'] as List?)?.whereType<Map<String, dynamic>>().toList() ??
          const <Map<String, dynamic>>[],
    );
  }
}

final diseaseGuidanceProvider = FutureProvider.autoDispose<DiseaseGuidance>((ref) async {
  final client = ref.read(apiClientProvider);
  final resp = await client.get<Map<String, dynamic>>('/v1/disease/guidance');
  return DiseaseGuidance.fromBody(resp.data ?? const <String, dynamic>{});
});
