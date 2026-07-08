/// NutriMind Restaurant Intelligence — menu OCR, chain DB, AI estimation (Phase 5).
///
/// `MenuNutritionEstimate` (AI estimation, labeled ESTIMATED with confidence) is implemented.
/// Chain DB lookup is deferred — `apps/api/src/restaurant/chain-loader.ts` has a
/// graceful-degradation interface ready, but no licensed chain nutrition dataset is wired up
/// yet (ADR-0018 §2). Menu OCR is handled server-side by `menu-scanner.ts`; this package does
/// not duplicate that logic, same single-source-of-truth pattern as `nutrimind_nutrition_rules`.
library nutrimind_restaurant_intelligence;

export 'src/menu_nutrition_estimate.dart';
