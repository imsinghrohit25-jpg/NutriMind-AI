// Unified health data service — abstracts HealthKit (iOS) and Health Connect (Android).
// Uploads batches to the API which runs dedup via external_id UNIQUE constraint.

import 'package:flutter/foundation.dart';
import 'package:health/health.dart';
import '../../core/network/api_client.dart';

// Canonical metric types we request from the platform.
const List<HealthDataType> kRequestedTypes = [
  HealthDataType.STEPS,
  HealthDataType.ACTIVE_ENERGY_BURNED,
  HealthDataType.BASAL_ENERGY_BURNED,
  HealthDataType.HEART_RATE,
  HealthDataType.WEIGHT,
  HealthDataType.SLEEP_ASLEEP,
  HealthDataType.WORKOUT,
  HealthDataType.BLOOD_OXYGEN,
];

class HealthSyncResult {
  const HealthSyncResult({
    required this.ingested,
    required this.skipped,
    required this.errors,
  });
  final int ingested;
  final int skipped;
  final int errors;
}

class HealthDataService {
  HealthDataService(this._api);

  final ApiClient _api;
  final Health _health = Health();

  /// Request permissions from HealthKit or Health Connect.
  Future<bool> requestPermissions() async {
    try {
      await _health.configure();
      final granted = await _health.requestAuthorization(kRequestedTypes);
      return granted;
    } catch (e) {
      debugPrint('[HealthDataService] requestPermissions error: $e');
      return false;
    }
  }

  /// Fetch and upload health data since [since] (default: 30 days back).
  Future<HealthSyncResult> syncToServer({DateTime? since}) async {
    final from = since ?? DateTime.now().subtract(const Duration(days: 30));
    final to   = DateTime.now();

    List<HealthDataPoint> points;
    try {
      points = await _health.getHealthDataFromTypes(
        startTime: from,
        endTime:   to,
        types:     kRequestedTypes,
      );
    } catch (e) {
      debugPrint('[HealthDataService] fetch error: $e');
      return const HealthSyncResult(ingested: 0, skipped: 0, errors: 1);
    }

    if (points.isEmpty) {
      return const HealthSyncResult(ingested: 0, skipped: 0, errors: 0);
    }

    final dedupedPoints = _health.removeDuplicates(points);

    final platform = defaultTargetPlatform == TargetPlatform.iOS
        ? 'healthkit'
        : 'health_connect';

    final metrics = dedupedPoints.map((p) => _toPayload(p, platform)).toList();

    int ingested = 0;
    int errors   = 0;
    for (var i = 0; i < metrics.length; i += 200) {
      final batch = metrics.sublist(i, (i + 200).clamp(0, metrics.length));
      try {
        final resp = await _api.post<Map<String, dynamic>>(
          '/api/v1/health/metrics/upload',
          data: {'metrics': batch},
        );
        ingested += (resp.data?['ingested'] as int? ?? 0);
      } catch (e) {
        debugPrint('[HealthDataService] upload batch error: $e');
        errors++;
      }
    }

    return HealthSyncResult(
      ingested: ingested,
      skipped:  dedupedPoints.length - ingested - errors,
      errors:   errors,
    );
  }

  Map<String, dynamic> _toPayload(HealthDataPoint p, String platform) {
    final metricType = _toMetricType(p.type);
    final externalId = '$platform:$metricType:${p.sourceId}_${p.dateFrom.millisecondsSinceEpoch}';
    return {
      'metricType':     metricType,
      'value':          (p.value as NumericHealthValue).numericValue.toDouble(),
      'unit':           _toUnit(p.type),
      'startTime':      p.dateFrom.toUtc().toIso8601String(),
      'endTime':        p.dateTo.toUtc().toIso8601String(),
      'sourcePlatform': platform,
      'externalId':     externalId,
    };
  }

  String _toMetricType(HealthDataType type) {
    switch (type) {
      case HealthDataType.STEPS:                return 'steps';
      case HealthDataType.ACTIVE_ENERGY_BURNED: return 'active_energy';
      case HealthDataType.BASAL_ENERGY_BURNED:  return 'resting_energy';
      case HealthDataType.HEART_RATE:           return 'heart_rate';
      case HealthDataType.WEIGHT:               return 'weight';
      case HealthDataType.SLEEP_ASLEEP:         return 'sleep_duration';
      case HealthDataType.WORKOUT:              return 'workout';
      case HealthDataType.BLOOD_OXYGEN:         return 'oxygen_saturation';
      default:                                  return type.name.toLowerCase();
    }
  }

  String _toUnit(HealthDataType type) {
    switch (type) {
      case HealthDataType.STEPS:                return 'count';
      case HealthDataType.ACTIVE_ENERGY_BURNED: return 'kcal';
      case HealthDataType.BASAL_ENERGY_BURNED:  return 'kcal';
      case HealthDataType.HEART_RATE:           return 'bpm';
      case HealthDataType.WEIGHT:               return 'kg';
      case HealthDataType.SLEEP_ASLEEP:         return 'minutes';
      case HealthDataType.WORKOUT:              return 'minutes';
      case HealthDataType.BLOOD_OXYGEN:         return 'percent';
      default:                                  return 'unknown';
    }
  }
}
