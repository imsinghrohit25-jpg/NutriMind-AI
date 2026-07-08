import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_restaurant_intelligence/nutrimind_restaurant_intelligence.dart';

void main() {
  group('MenuNutritionEstimate.fromJson', () {
    test('parses a typical API response', () {
      final estimate = MenuNutritionEstimate.fromJson({
        'nutrients': {
          'calories': 450, 'protein': 20.0, 'carbs': 55.0,
          'fat': 15.0, 'fibre': 4.0, 'sodium': 300.0,
        },
        'isEstimated': true,
        'confidence': 0.35,
        'basis': 'ingredient_density',
      });

      expect(estimate.calories, 450);
      expect(estimate.proteinG, 20.0);
      expect(estimate.confidence, 0.35);
      expect(estimate.basis, 'ingredient_density');
      expect(estimate.isLowConfidence, isFalse); // 0.35 is above the 0.3 low-confidence cutoff
    });

    test('handles missing nutrient fields gracefully', () {
      final estimate = MenuNutritionEstimate.fromJson({
        'nutrients': <String, dynamic>{},
        'isEstimated': true,
        'confidence': 0.15,
        'basis': 'no_ingredients_unknown',
      });

      expect(estimate.calories, 0);
      expect(estimate.basis, 'no_ingredients_unknown');
    });

    test('isLowConfidence is true below 0.3', () {
      final estimate = MenuNutritionEstimate.fromJson({
        'nutrients': <String, dynamic>{},
        'confidence': 0.15,
        'basis': 'no_ingredients_unknown',
      });
      expect(estimate.isLowConfidence, isTrue);
    });
  });
}
