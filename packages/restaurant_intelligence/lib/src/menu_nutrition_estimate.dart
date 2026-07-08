/// Dart-side mirror of `MenuItemNutritionEstimate` (`apps/api/src/restaurant/menu-scanner.ts`).
/// Always represents an *estimate* — `isEstimated` is always `true` server-side, and the UI
/// must render the "ESTIMATED" badge described in this package's original scope note whenever
/// this model is shown, never presenting it as a measured nutrition value.
class MenuNutritionEstimate {
  const MenuNutritionEstimate({
    required this.calories,
    required this.proteinG,
    required this.carbsG,
    required this.fatG,
    required this.fibreG,
    required this.sodiumMg,
    required this.confidence,
    required this.basis,
  });

  final num calories;
  final num proteinG;
  final num carbsG;
  final num fatG;
  final num fibreG;
  final num sodiumMg;

  /// 0.0–1.0 — always low (server caps this at 0.35); this is a rough per-portion
  /// approximation, not a lab value.
  final double confidence;

  /// 'ingredient_density' when the menu item's ingredients were identified and priced via
  /// the density estimator, or 'no_ingredients_unknown' when no ingredients were available
  /// and only a category-based portion-size fallback was used.
  final String basis;

  /// True whenever confidence is low enough that the UI should visually de-emphasize this
  /// estimate (e.g. muted text, smaller badge) rather than presenting it at full weight.
  bool get isLowConfidence => confidence < 0.3;

  factory MenuNutritionEstimate.fromJson(Map<String, dynamic> j) {
    final n = j['nutrients'] as Map<String, dynamic>;
    return MenuNutritionEstimate(
      calories:   n['calories'] as num? ?? 0,
      proteinG:   n['protein']  as num? ?? 0,
      carbsG:     n['carbs']    as num? ?? 0,
      fatG:       n['fat']      as num? ?? 0,
      fibreG:     n['fibre']    as num? ?? 0,
      sodiumMg:   n['sodium']   as num? ?? 0,
      confidence: (j['confidence'] as num?)?.toDouble() ?? 0.0,
      basis:      j['basis'] as String? ?? 'no_ingredients_unknown',
    );
  }
}
