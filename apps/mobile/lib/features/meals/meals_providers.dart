import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';

/// Today's food-diary report from `GET /v1/meals/day` — the entries, the aggregated
/// [total] (engine `DailyNutritionTotal`) and the [gapReport] (engine `DailyGapReport` vs the
/// user's personalised budget). Shapes map 1:1 onto the existing MealLogScreen / DailyDashboard
/// widgets, so no transformation or duplicate models are needed.
class MealDayReport {
  const MealDayReport({
    required this.date,
    required this.entries,
    required this.total,
    required this.gapReport,
  });

  final String date;
  final List<Map<String, dynamic>> entries; // engine MealEntry[]
  final Map<String, dynamic>? total; // DailyNutritionTotal
  final Map<String, dynamic>? gapReport; // DailyGapReport (null when profile incomplete)

  bool get isEmpty => entries.isEmpty;

  double get consumedKcal => (total?['energyKcal'] as num?)?.toDouble() ?? 0;

  /// The user's daily calorie budget, read from the gap report's Calories row (null when there's
  /// no computed budget — e.g. an incomplete profile).
  double? get budgetKcal {
    final gaps = (gapReport?['gaps'] as List?)?.whereType<Map<String, dynamic>>() ?? const [];
    for (final g in gaps) {
      if (g['nutrient'] == 'Calories') return (g['budget'] as num?)?.toDouble();
    }
    return null;
  }

  String get overallStatus => gapReport?['overallStatus'] as String? ?? 'on_track';

  factory MealDayReport.fromBody(Map<String, dynamic> body) {
    final data = body['data'] is Map<String, dynamic> ? body['data'] as Map<String, dynamic> : body;
    return MealDayReport(
      date: data['date'] as String? ?? '',
      entries: (data['entries'] as List?)?.whereType<Map<String, dynamic>>().toList() ??
          const <Map<String, dynamic>>[],
      total: data['total'] as Map<String, dynamic>?,
      gapReport: data['gapReport'] as Map<String, dynamic>?,
    );
  }
}

/// Today's diary. autoDispose so it re-fetches on each Home visit; invalidated after a log write.
final mealDayReportProvider = FutureProvider.autoDispose<MealDayReport>((ref) async {
  final client = ref.read(apiClientProvider);
  final resp = await client.get<Map<String, dynamic>>('/v1/meals/day');
  return MealDayReport.fromBody(resp.data ?? const <String, dynamic>{});
});

/// The current week's rendered report from `GET /v1/meals/weekly` (the same compute the weekly
/// push-notification job uses). [report] maps 1:1 onto the existing WeeklyReportScreen; [available]
/// is false when nothing was logged this week (honest empty state, no fabricated report).
class WeeklyReport {
  const WeeklyReport({required this.available, required this.report, required this.weekStart});

  final bool available;
  final Map<String, dynamic>? report;
  final String weekStart;

  factory WeeklyReport.fromBody(Map<String, dynamic> body) {
    final data = body['data'] is Map<String, dynamic> ? body['data'] as Map<String, dynamic> : body;
    return WeeklyReport(
      available: data['available'] == true,
      report: data['report'] as Map<String, dynamic>?,
      weekStart: data['weekStart'] as String? ?? '',
    );
  }
}

final weeklyReportProvider = FutureProvider.autoDispose<WeeklyReport>((ref) async {
  final client = ref.read(apiClientProvider);
  final resp = await client.get<Map<String, dynamic>>('/v1/meals/weekly');
  return WeeklyReport.fromBody(resp.data ?? const <String, dynamic>{});
});

/// Logs one meal via `POST /v1/meals`. The server computes serving nutrition from [nutritionPer100g]
/// (the caller's already-resolved product/scan nutrition) — never fabricated. Invalidates the
/// day report so the diary + Home summary refresh.
Future<void> logMeal(
  WidgetRef ref, {
  required String mealType,
  required String foodName,
  String? productId,
  required double quantityG,
  required Map<String, dynamic> nutritionPer100g,
  String? nutritionSource,
  bool isEstimated = false,
}) async {
  final client = ref.read(apiClientProvider);
  await client.post<Map<String, dynamic>>('/v1/meals', data: {
    'mealType': mealType,
    'foodName': foodName,
    if (productId != null) 'productId': productId,
    'quantityG': quantityG,
    'nutritionPer100g': nutritionPer100g,
    if (nutritionSource != null) 'nutritionSource': nutritionSource,
    'isEstimated': isEstimated,
  });
  ref.invalidate(mealDayReportProvider);
}
