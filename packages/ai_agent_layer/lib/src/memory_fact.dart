/// Client-side DTO for a single AI Memory System fact (Phase 11, `apps/api/src/memory/facts-service.ts`'s
/// `StoredMemoryFact`). This package is a thin client — the actual four-layer memory
/// architecture (episodic events, deterministic aggregation, semantic embeddings, working-memory
/// context assembly) runs server-side; this type only carries what the transparency UI needs to
/// render and let a user delete their own memory.
class MemoryFact {
  const MemoryFact({
    required this.factId,
    required this.factType,
    required this.factKey,
    required this.value,
    required this.confidence,
    required this.computedAt,
    required this.validUntil,
  });

  final String factId;
  final String factType;
  final String factKey;
  final Map<String, dynamic> value;
  final double confidence;
  final DateTime computedAt;
  final DateTime validUntil;

  factory MemoryFact.fromJson(Map<String, dynamic> json) {
    return MemoryFact(
      factId: json['factId'] as String,
      factType: json['factType'] as String,
      factKey: json['factKey'] as String,
      value: Map<String, dynamic>.from(json['value'] as Map),
      confidence: (json['confidence'] as num).toDouble(),
      computedAt: DateTime.parse(json['computedAt'] as String),
      validUntil: DateTime.parse(json['validUntil'] as String),
    );
  }

  /// Human-readable section label for the transparency UI — mirrors the server's
  /// context-assembler.ts SECTION_ORDER labels, but this is display-only; it has no bearing on
  /// what the server actually sends an LLM.
  String get sectionLabel {
    switch (factType) {
      case 'eating_pattern': return 'Eating patterns';
      case 'user_habit': return 'App habits';
      case 'health_goal': return 'Health goals';
      case 'family_preference': return 'Household preferences';
      case 'regional_cuisine_affinity': return 'Cuisine preferences';
      case 'travel_history': return 'Travel history';
      case 'seasonal_pattern': return 'Seasonal patterns';
      default: return factType;
    }
  }
}
